// Forum d'entraide : sujets, réponses, votes « utile ». Les noms affichés sont « Prénom I. », jamais le nom complet.
const { db } = require('../db');

const CATEGORIES = {
    cv: '📄 CV et lettres', entretien: '🗣️ Entretiens', alternance: '🎓 Alternance et formation', reconversion: '🔄 Reconversion',
    droits: '⚖️ Droits et aides', temoignages: '🎉 Témoignages et réussites', metiers: '🧰 Métiers et secteurs', divers: '☕ Discussions libres'
};

db.exec(`
    CREATE TABLE IF NOT EXISTS forum_topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        author_id TEXT NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'visible',   -- visible | hidden | deleted
        replies INTEGER NOT NULL DEFAULT 0, likes INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, last_activity TEXT NOT NULL, edited_at TEXT
    );
    CREATE TABLE IF NOT EXISTS forum_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id INTEGER NOT NULL, author_id TEXT NOT NULL, body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'visible', likes INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, edited_at TEXT
    );
    CREATE TABLE IF NOT EXISTS forum_likes (kind TEXT NOT NULL, target_id INTEGER NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (kind, target_id, user_id));
    CREATE INDEX IF NOT EXISTS forum_posts_topic ON forum_posts (topic_id, id);
    CREATE INDEX IF NOT EXISTS forum_topics_activity ON forum_topics (status, last_activity);
`);
const st = {
    topic: db.prepare('SELECT * FROM forum_topics WHERE id = ?'),
    post: db.prepare('SELECT * FROM forum_posts WHERE id = ?'),
    posts: db.prepare('SELECT * FROM forum_posts WHERE topic_id = ? AND status != \'deleted\' ORDER BY id'),
    addTopic: db.prepare('INSERT INTO forum_topics (author_id, category, title, body, created_at, last_activity) VALUES (?, ?, ?, ?, ?, ?)'),
    addPost: db.prepare('INSERT INTO forum_posts (topic_id, author_id, body, created_at) VALUES (?, ?, ?, ?)'),
    bump: db.prepare('UPDATE forum_topics SET replies = (SELECT COUNT(*) FROM forum_posts WHERE topic_id = ? AND status = \'visible\'), last_activity = ? WHERE id = ?'),
    recount: db.prepare('UPDATE forum_topics SET replies = (SELECT COUNT(*) FROM forum_posts WHERE topic_id = ? AND status = \'visible\') WHERE id = ?'),
    topicStatus: db.prepare('UPDATE forum_topics SET status = ? WHERE id = ?'),
    postStatus: db.prepare('UPDATE forum_posts SET status = ? WHERE id = ?'),
    editTopic: db.prepare('UPDATE forum_topics SET title = ?, body = ?, edited_at = ? WHERE id = ?'),
    editPost: db.prepare('UPDATE forum_posts SET body = ?, edited_at = ? WHERE id = ?'),
    likeAdd: db.prepare('INSERT OR IGNORE INTO forum_likes (kind, target_id, user_id) VALUES (?, ?, ?)'),
    likeDel: db.prepare('DELETE FROM forum_likes WHERE kind = ? AND target_id = ? AND user_id = ?'),
    likeHas: db.prepare('SELECT 1 FROM forum_likes WHERE kind = ? AND target_id = ? AND user_id = ?'),
    likeCount: db.prepare('SELECT COUNT(*) AS n FROM forum_likes WHERE kind = ? AND target_id = ?'),
    myLikes: db.prepare('SELECT kind, target_id FROM forum_likes WHERE user_id = ?'),
    setTopicLikes: db.prepare('UPDATE forum_topics SET likes = ? WHERE id = ?'),
    setPostLikes: db.prepare('UPDATE forum_posts SET likes = ? WHERE id = ?'),
    hideByAuthorT: db.prepare('UPDATE forum_topics SET status = \'hidden\' WHERE author_id = ? AND status = \'visible\''),
    hideByAuthorP: db.prepare('UPDATE forum_posts SET status = \'hidden\' WHERE author_id = ? AND status = \'visible\'')
};

function listTopics({ category, q, page = 1, limit = 20 }) {
    const where = ['status = \'visible\''], args = [];
    if (CATEGORIES[category]) { where.push('category = ?'); args.push(category); }
    if (q) { where.push('(title LIKE ? OR body LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
    const total = db.prepare(`SELECT COUNT(*) AS n FROM forum_topics WHERE ${where.join(' AND ')}`).get(...args).n;
    const rows = db.prepare(`SELECT * FROM forum_topics WHERE ${where.join(' AND ')} ORDER BY last_activity DESC LIMIT ? OFFSET ?`).all(...args, limit, (page - 1) * limit);
    return { total, rows };
}
const getTopic = (id) => st.topic.get(Number(id)) || null;
const getPost = (id) => st.post.get(Number(id)) || null;
const postsOf = (topicId) => st.posts.all(Number(topicId));
function addTopic(authorId, category, title, body) {
    const now = new Date().toISOString();
    return Number(st.addTopic.run(authorId, category, title, body, now, now).lastInsertRowid);
}
function addPost(topicId, authorId, body) {
    const now = new Date().toISOString();
    const id = Number(st.addPost.run(Number(topicId), authorId, body, now).lastInsertRowid);
    st.bump.run(Number(topicId), now, Number(topicId));
    return id;
}
function setStatus(kind, id, status) {
    if (kind === 'topic') st.topicStatus.run(status, Number(id));
    else if (kind === 'post') { st.postStatus.run(status, Number(id)); const p = getPost(id); if (p) st.recount.run(p.topic_id, p.topic_id); }
    else if (kind === 'message') require('./messaging').setMessageHidden(id, status !== 'visible');
}
// Seuil de signalements atteint : masqué jusqu'à la décision d'un administrateur
function hideByReports(kind, id) { setStatus(kind, id, 'hidden'); }
function editTopic(id, title, body) { st.editTopic.run(title, body, new Date().toISOString(), Number(id)); }
function editPost(id, body) { st.editPost.run(body, new Date().toISOString(), Number(id)); }
function toggleLike(kind, id, userId) {
    const has = st.likeHas.get(kind, Number(id), userId);
    if (has) st.likeDel.run(kind, Number(id), userId); else st.likeAdd.run(kind, Number(id), userId);
    const n = st.likeCount.get(kind, Number(id)).n;
    (kind === 'topic' ? st.setTopicLikes : st.setPostLikes).run(n, Number(id));
    return { liked: !has, likes: n };
}
function likedBy(userId) { return new Set(st.myLikes.all(userId).map(r => r.kind + ':' + r.target_id)); }
// Compte suspendu : tous ses contenus sont masqués
function hideAllFrom(userId) { st.hideByAuthorT.run(userId); st.hideByAuthorP.run(userId); }

module.exports = { CATEGORIES, listTopics, getTopic, getPost, postsOf, addTopic, addPost, setStatus, hideByReports, editTopic, editPost, toggleLike, likedBy, hideAllFrom };

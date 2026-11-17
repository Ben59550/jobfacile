// Routes PDF : CV (3 modèles, photo) et lettre de motivation.
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const router = require('express').Router();
const { UPLOADS_DIR } = require('../config');
const { requireAuth } = require('../security');
const { qualifLabelsServer } = require('../services/qualifs');
const { fold } = require('../utils');

// ---------- PDF : CV (3 modèles, photo) et lettre de motivation ----------
const CV_TEMPLATES = {
    moderne: { accent: '#047857', dark: '#064e3b' },
    classique: { accent: '#1e3a8a', dark: '#0f172a' },
    compact: { accent: '#b45309', dark: '#78350f' }
};
// pdfkit ne lit que le JPEG et le PNG
function avatarPath(u) {
    if (!u.avatarUrl || !u.avatarUrl.startsWith('/uploads/')) return null;
    const p = path.join(UPLOADS_DIR, path.basename(u.avatarUrl));
    try {
        const head = Buffer.alloc(4);
        const fd = fs.openSync(p, 'r'); fs.readSync(fd, head, 0, 4, 0); fs.closeSync(fd);
        const isPng = head[0] === 0x89 && head[1] === 0x50, isJpg = head[0] === 0xff && head[1] === 0xd8;
        return isPng || isJpg ? p : null;
    } catch (e) { return null; }
}
// Les polices standard du PDF ne contiennent pas les émojis ni certains symboles
function pdfSafe(t) { return String(t ?? '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/[‐-–]/g, '-'); }

function cvData(u, b) {
    const s = (v, max) => pdfSafe(String(v ?? '').trim().slice(0, max));
    const userSkills = (u.skills || []).filter(x => typeof x === 'string');
    const known = new Map(userSkills.map(x => [fold(x), x]));
    // Les compétences envoyées ne peuvent que réordonner celles du profil
    const skills = Array.isArray(b.skills) ? [...new Set(b.skills.map(x => known.get(fold(x))).filter(Boolean))] : userSkills;
    const baseExp = (u.experience || []).filter(e => e && (e.title || e.company));
    const expOverride = Array.isArray(b.experience) ? b.experience : null;
    const experience = baseExp.map((e, i) => ({
        title: s(e.title, 120), company: s(e.company, 120), period: s(e.period, 60),
        desc: s(expOverride && expOverride[i] && expOverride[i].desc !== undefined ? expOverride[i].desc : e.desc, 600)
    }));
    const q = qualifLabelsServer(u);
    return {
        name: s(`${u.firstName || ''} ${u.lastName || ''}`, 120) || 'Candidat JobFacile',
        targetJob: s(b.targetJob, 120) || s(u.desiredJob, 120) || '',
        headline: s(u.headline, 120),
        email: s(u.email, 120), phone: s(u.phone, 30),
        where: s([u.postalCode, u.city].filter(Boolean).join(' '), 100),
        links: [u.linkedin, u.portfolio].filter(Boolean).map(x => s(String(x).replace(/^https?:\/\/(www\.)?/i, ''), 80)),
        summary: s(b.summary !== undefined ? b.summary : (b.contentText || u.bio), 1500),
        skills: skills.map(x => s(x, 60)).slice(0, 20),
        experience,
        education: (u.education || []).filter(e => e && (e.degree || e.school)).map(e => ({ degree: s(e.degree, 120), school: s(e.school, 120), year: s(e.year, 30) })),
        languages: (u.languages || []).map(l => s(l.level ? `${l.lang} (${l.level})` : l.lang, 60)),
        qualifs: [...q.licenses, ...q.caces, ...q.habilitations].map(x => s(x, 80)),
        extras: [u.vehicle ? 'Véhiculé(e)' : '', u.availability ? `Disponibilité : ${u.availability}` : ''].filter(Boolean).map(x => s(x, 60)),
        photo: b.includePhoto === false ? null : avatarPath(u)
    };
}

function renderCv(doc, d, templateName) {
    const T = CV_TEMPLATES[templateName] || CV_TEMPLATES.moderne;
    const W = doc.page.width, H = doc.page.height;
    const ink = '#1e293b', muted = '#64748b';

    // Titre de rubrique dans la colonne principale
    const section = (title) => {
        if (doc.y > H - 110) doc.addPage();
        doc.moveDown(0.6);
        doc.font('Helvetica-Bold').fontSize(11).fillColor(T.accent).text(title.toUpperCase(), { characterSpacing: 1 });
        const y = doc.y + 2;
        doc.save().strokeColor(T.accent).lineWidth(templateName === 'classique' ? 0.6 : 1.4)
            .moveTo(doc.page.margins.left, y).lineTo(templateName === 'classique' ? W - doc.page.margins.right : doc.page.margins.left + 40, y).stroke().restore();
        doc.moveDown(0.6);
    };
    const mainBlocks = () => {
        if (d.summary) {
            section('Profil');
            doc.font('Helvetica').fontSize(10).fillColor(ink).text(d.summary, { lineGap: 3, align: 'justify' });
        }
        if (d.experience.length) {
            section('Expériences professionnelles');
            d.experience.forEach((e, i) => {
                if (doc.y > H - 90) doc.addPage();
                const top = doc.y;
                doc.font('Helvetica-Bold').fontSize(10.5).fillColor(ink).text(e.title || e.company, { continued: !!(e.title && e.company) });
                if (e.title && e.company) doc.font('Helvetica').fillColor(muted).text(`  ·  ${e.company}`);
                if (e.period) doc.font('Helvetica-Oblique').fontSize(9).fillColor(T.accent).text(e.period);
                if (e.desc) doc.moveDown(0.15).font('Helvetica').fontSize(9.5).fillColor('#334155').text(e.desc, { lineGap: 2 });
                if (i < d.experience.length - 1) doc.moveDown(0.7);
                void top;
            });
        }
        if (d.education.length) {
            section('Diplômes & formations');
            d.education.forEach(e => {
                doc.font('Helvetica-Bold').fontSize(10).fillColor(ink).text(e.degree || e.school, { continued: !!e.year });
                if (e.year) doc.font('Helvetica').fillColor(T.accent).text(`  ${e.year}`);
                if (e.degree && e.school) doc.font('Helvetica').fontSize(9.5).fillColor(muted).text(e.school);
                doc.moveDown(0.4);
            });
        }
    };
    const contactLines = [d.phone, d.email, d.where, ...d.links].filter(Boolean);

    if (templateName === 'moderne') {
        // Colonne latérale colorée + colonne principale
        const SB = 190;
        const drawSidebarBg = () => doc.save().rect(0, 0, SB, H).fill(T.dark).restore();
        drawSidebarBg();
        doc.on('pageAdded', drawSidebarBg);
        let y = 36;
        if (d.photo) {
            try {
                doc.save().circle(SB / 2, y + 55, 55).clip().image(d.photo, SB / 2 - 55, y, { cover: [110, 110], align: 'center', valign: 'center' }).restore();
                doc.save().circle(SB / 2, y + 55, 55).lineWidth(3).strokeColor('#ffffff').stroke().restore();
                y += 130;
            } catch (e) { doc.restore(); }
        }
        const side = (title, items, opts = {}) => {
            if (!items.length || y > H - 80) return;
            doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#a7f3d0').text(title.toUpperCase(), 22, y, { width: SB - 44, characterSpacing: 1, lineBreak: false });
            y += 16;
            for (const it of items) {
                const h = doc.font('Helvetica').fontSize(opts.size || 9).heightOfString(it, { width: SB - 44 });
                if (y + h > H - 40) break;
                doc.fillColor('#ecfdf5').text(it, 22, y, { width: SB - 44 });
                y += h + 4;
            }
            y += 12;
        };
        side('Contact', contactLines);
        side('Compétences', d.skills.slice(0, 12).map(x => '• ' + x));
        side('Permis & habilitations', d.qualifs.slice(0, 10).map(x => '• ' + x));
        side('Langues', d.languages);
        side('Atouts', d.extras);

        doc.page.margins = { top: 40, bottom: 40, left: SB + 28, right: 36 };
        doc.x = SB + 28; doc.y = 44;
        doc.font('Helvetica-Bold').fontSize(24).fillColor(ink).text(d.name);
        if (d.targetJob) doc.font('Helvetica').fontSize(13).fillColor(T.accent).text(d.targetJob);
        if (d.headline && d.headline !== d.targetJob) doc.font('Helvetica-Oblique').fontSize(10).fillColor(muted).text(d.headline);
        mainBlocks();
        return;
    }

    if (templateName === 'compact') {
        // Bandeau coloré en haut, compétences en pastilles, une seule colonne
        const band = 118;
        doc.save().rect(0, 0, W, band).fill(T.dark).restore();
        let x = 40;
        if (d.photo) {
            try {
                doc.save().roundedRect(40, 22, 74, 74, 12).clip().image(d.photo, 40, 22, { cover: [74, 74], align: 'center', valign: 'center' }).restore();
                x = 132;
            } catch (e) { doc.restore(); }
        }
        doc.font('Helvetica-Bold').fontSize(22).fillColor('#ffffff').text(d.name, x, 28, { width: W - x - 40 });
        if (d.targetJob) doc.font('Helvetica').fontSize(12).fillColor('#fde68a').text(d.targetJob, x, doc.y, { width: W - x - 40 });
        doc.font('Helvetica').fontSize(8.5).fillColor('#fef3c7').text(contactLines.join('   |   '), x, doc.y + 6, { width: W - x - 40 });
        doc.page.margins = { top: 40, bottom: 40, left: 40, right: 40 };
        doc.x = 40; doc.y = band + 14;
        if (d.skills.length) {
            // Pastilles
            let cx = 40, cy = doc.y;
            doc.font('Helvetica-Bold').fontSize(8.5);
            for (const sk of d.skills.slice(0, 16)) {
                const w = doc.widthOfString(sk) + 16;
                if (cx + w > W - 40) { cx = 40; cy += 20; }
                doc.save().roundedRect(cx, cy, w, 15, 7).fill('#fef3c7').restore();
                doc.fillColor(T.dark).text(sk, cx + 8, cy + 3.5, { lineBreak: false });
                cx += w + 6;
            }
            doc.x = 40; doc.y = cy + 22;
        }
        mainBlocks();
        const tail = [
            d.qualifs.length ? ['Permis & habilitations', d.qualifs.join(' · ')] : null,
            d.languages.length ? ['Langues', d.languages.join(' · ')] : null,
            d.extras.length ? ['Atouts', d.extras.join(' · ')] : null
        ].filter(Boolean);
        for (const [t, v] of tail) { section(t); doc.font('Helvetica').fontSize(9.5).fillColor(ink).text(v, { lineGap: 2 }); }
        return;
    }

    // Classique : en-tête centré, sobre, une colonne
    doc.page.margins = { top: 46, bottom: 46, left: 56, right: 56 };
    let top = 46;
    if (d.photo) {
        try { doc.save().circle(W - 56 - 36, top + 36, 36).clip().image(d.photo, W - 56 - 72, top, { cover: [72, 72], align: 'center', valign: 'center' }).restore(); }
        catch (e) { doc.restore(); }
    }
    const headW = W - 112 - (d.photo ? 90 : 0);
    doc.font('Times-Bold').fontSize(24).fillColor(T.dark).text(d.name, 56, top, { width: headW });
    if (d.targetJob) doc.font('Times-Italic').fontSize(13).fillColor(T.accent).text(d.targetJob, { width: headW });
    doc.moveDown(0.3).font('Helvetica').fontSize(9).fillColor(muted).text(contactLines.join('  ·  '), { width: headW });
    doc.y = Math.max(doc.y, d.photo ? top + 80 : 0);
    doc.x = 56;
    mainBlocks();
    const tail = [
        d.skills.length ? ['Compétences', d.skills.join(' · ')] : null,
        d.qualifs.length ? ['Permis & habilitations', d.qualifs.join(' · ')] : null,
        d.languages.length ? ['Langues', d.languages.join(' · ')] : null,
        d.extras.length ? ['Atouts', d.extras.join(' · ')] : null
    ].filter(Boolean);
    for (const [t, v] of tail) { section(t); doc.font('Helvetica').fontSize(9.5).fillColor(ink).text(v, { lineGap: 2 }); }
}

function renderLetter(doc, d, text) {
    const accent = CV_TEMPLATES.moderne.accent;
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text(d.name);
    doc.font('Helvetica').fontSize(9.5).fillColor('#64748b').text([d.phone, d.email, d.where].filter(Boolean).join('  ·  '));
    doc.moveDown(0.5).save().strokeColor(accent).lineWidth(1.2).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + 50, doc.y).stroke().restore();
    doc.moveDown(1.2);
    if (d.targetJob) doc.font('Helvetica-Bold').fontSize(10.5).fillColor(accent).text(`Objet : candidature au poste de ${d.targetJob}`).moveDown(1);
    doc.font('Helvetica').fontSize(10.5).fillColor('#1e293b').text(pdfSafe(text), { lineGap: 4, align: 'justify' });
}

router.post('/api/ai/download-cv', requireAuth, (req, res) => {
    const b = req.body || {};
    const u = req.user;
    const isLetter = b.docType === 'lm';
    const template = Object.keys(CV_TEMPLATES).includes(b.template) ? b.template : 'moderne';
    const d = cvData(u, b);
    const prefix = isLetter ? 'Lettre' : 'CV';
    const label = d.targetJob || 'Poste';
    const asciiName = `${prefix}_${label}`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_');
    const utf8Name = encodeURIComponent(`${prefix}_${label.replace(/\s+/g, '_')}.pdf`);

    let doc;
    try {
        doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `${prefix} - ${d.name}`, Author: d.name, Creator: 'JobFacile' } });
    } catch (e) {
        console.error('Erreur PDF :', e);
        return res.status(500).json({ success: false, message: 'Erreur lors de la génération du PDF.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${asciiName}.pdf"; filename*=UTF-8''${utf8Name}`);
    doc.on('error', (e) => { console.error('Erreur PDF :', e); res.end(); });
    doc.pipe(res);
    try {
        if (isLetter) renderLetter(doc, d, String(b.contentText || '').slice(0, 8000));
        else renderCv(doc, d, template);
    } catch (e) { console.error('Rendu PDF :', e); }
    doc.end();
});

module.exports = router;

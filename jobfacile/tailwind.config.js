// Mise en forme du site : Tailwind compilé une fois dans public/css/tw.css (npm run css, lancé aussi par npm run assets).
// Tailwind lit ces fichiers pour ne garder que les classes utilisées. Une classe écrite en morceaux
// (ex. 'bg-' + couleur) n'est pas détectée : toujours écrire le nom complet.
module.exports = {
    content: ['./public/index.html', './public/js/**/*.js', './src/**/*.js'],
    theme: { extend: {
        fontFamily: { sans: ['"Archivo"', 'system-ui', 'sans-serif'] },
        // Couleurs du thème choisi (variables --e-* et --t-* de app.css, voir « Thèmes de couleur »)
        colors: {
            emerald: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map(s => [s, `rgb(var(--e-${s}) / <alpha-value>)`])),
            teal: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map(s => [s, `rgb(var(--t-${s}) / <alpha-value>)`]))
        }
    } }
};

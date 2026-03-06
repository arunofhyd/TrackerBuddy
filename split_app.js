const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf-8');

function extract(functions, file, imports) {
    let extracted = imports + '\n\n';
    functions.forEach(fn => {
        const regex = new RegExp(`^async function ${fn}\\([\\s\\S]*?\\n}$|^function ${fn}\\([\\s\\S]*?\\n}$`, 'm');
        const match = code.match(regex);
        if (match) {
            extracted += `export ${match[0]}\n\n`;
            code = code.replace(match[0], '');
        } else {
            console.log('Missed', fn);
        }
    });
    fs.writeFileSync(file, extracted);
}
// just a quick test
console.log('Script created');

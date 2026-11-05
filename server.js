const http = require('http');

const MODEL = 'gemma3:4b'; // pon el nombre exacto que salga en `ollama list`

const PAGE = `<!DOCTYPE html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AnimeTop</title>
<style>
body { font-family: sans-serif; margin: 0; color: #222; line-height: 1.6; }
main { max-width: 700px; margin: 0 auto; padding: 60px 20px; }
h1 { font-size: 2.5em; margin-bottom: 0; }
.cta { display: inline-block; margin-top: 10px; padding: 12px 20px; background: #6c47ff; color: #fff; text-decoration: none; border-radius: 8px; }
.cards { display: flex; gap: 16px; flex-wrap: wrap; margin: 30px 0; }
.card { flex: 1; min-width: 180px; padding: 16px; background: #f1eeff; border-radius: 10px; }

#box { position: fixed; right: 20px; bottom: 20px; width: 320px; height: 420px; display: flex;
flex-direction: column; background: #212121; color: #eee; border-radius: 12px; box-shadow: 0 4px 20px #0006; }
#chat { flex: 1; overflow-y: auto; padding: 12px; font-size: 14px; }
.msg { margin: 8px 0; padding: 8px 12px; border-radius: 10px; white-space: pre-wrap; max-width: 85%; }
.user { background: #2f2f2f; margin-left: auto; }
.bot { background: #343541; }
form { display: flex; gap: 6px; padding: 10px; }
input { flex: 1; padding: 8px; border-radius: 6px; border: 0; background: #2f2f2f; color: #eee; }
button { padding: 8px 12px; border-radius: 6px; border: 0; cursor: pointer; }
</style>

<main>
<h1>AnimeTop</h1>
<p>Una selección corta de animes imprescindibles para empezar, sin perderte entre miles de títulos.</p>
<a class="cta" href="#">Ver la lista</a>

<div class="cards">
<div class="card"><h3>Fullmetal Alchemist: Brotherhood</h3><p>Aventura y fantasía (2009). Dos hermanos buscan recuperar lo que perdieron usando la alquimia.</p></div>
<div class="card"><h3>Steins;Gate</h3><p>Ciencia ficción y suspense (2011). Un grupo de amigos descubre cómo enviar mensajes al pasado.</p></div>
<div class="card"><h3>Cowboy Bebop</h3><p>Acción y espacio (1998). Cazarrecompensas que viajan por el sistema solar.</p></div>
<div class="card"><h3>Frieren</h3><p>Fantasía y drama (2023). Una maga elfa reflexiona sobre el tiempo tras acabar su gran aventura.</p></div>
<div class="card"><h3>Hunter x Hunter</h3><p>Aventura y acción (2011). Un chico se hace cazador para encontrar a su padre.</p></div>
</div>

<p>Cada semana añadimos recomendaciones nuevas según género: acción, romance, comedia y más.</p>
</main>

<div id="box">
<div id="chat"></div>
<form id="form">
<input id="input" placeholder="Pregunta sobre la página..." autocomplete="off">
<button>Enviar</button>
</form>
</div>

<script>
const messages = [];
const context = 'Eres el asistente de esta página web de animes. Responde en español, de forma breve. Usa primero la información de la página. Si no está ahí, usa la información de Wikipedia que va junto a la pregunta. Si tampoco aparece, di que no lo sabes. Información de la página:\\n'
form.onsubmit = async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    add('user', text);
    messages.push({ role: 'user', content: text });

    const bot = add('bot', '...');
    const body = [{ role: 'system', content: context }, ...messages];
    const res = await fetch('/chat', { method: 'POST', body: JSON.stringify(body) });
    const reply = await res.text();

    bot.textContent = reply;
    messages.push({ role: 'assistant', content: reply });
};

function add(role, text) {
    const div = document.createElement('div');
    div.className = 'msg ' + role;
    div.textContent = text;
    chat.append(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
}
</script>`;

const TEMA = 'anime';

async function search(q) {
    try {
        const url = 'https://es.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=2'
        + '&prop=extracts&exintro=1&explaintext=1&exchars=700&gsrsearch=' + encodeURIComponent(q + ' ' + TEMA);
        const res = await fetch(url, { headers: { 'User-Agent': 'AnimeTopChat/1.0' } });
        const data = await res.json();
        return Object.values(data.query?.pages || {}).map(p => p.title + ': ' + p.extract).join('\n\n');
    } catch {
        return '';
    }
}

http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/chat') {
        try {
            let body = '';
            for await (const chunk of req) body += chunk;

            const messages = JSON.parse(body);
            const last = messages[messages.length - 1];
            const wiki = await search(last.content);
            last.content = 'Datos de la página:\n' + messages[0].content
            + '\n\nDatos de Wikipedia:\n' + wiki
            + '\n\nResponde en español, en una frase, usando los datos de arriba. Pregunta: ' + last.content;
            const ollama = await fetch('http://localhost:11434/api/chat', {
                method: 'POST',
                body: JSON.stringify({ model: MODEL, messages, stream: false, options: { temperature: 0 } }),
            });
            const data = await ollama.json();
            res.end(data.message.content.replace(/[\s\S]*<\/think>/, '').trim());
        } catch (err) {
            res.end('Error: ' + err.message);
        }
    } else {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(PAGE);
    }
}).listen(3000, () => console.log('Abre http://localhost:3000'));

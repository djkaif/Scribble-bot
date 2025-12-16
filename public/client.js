const socket = io();
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let drawing = false;

// Handle different screen sizes
function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const urlParams = new URLSearchParams(window.location.search);
const room = urlParams.get('room') || 'default';
let username = prompt("Enter username:") || "Guest";

socket.emit('joinRoom', { room, username });

// --- DRAWING LOGIC (Mouse + Touch) ---
function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
    };
}

function startDrawing(e) {
    drawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
}

function draw(e) {
    if (!drawing) return;
    if (e.touches) e.preventDefault(); // Stop mobile from scrolling while drawing
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    socket.emit('draw', { x: pos.x, y: pos.y, room });
}

function stopDrawing() {
    drawing = false;
}

// Mouse Events
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);

// Touch Events (MOBILE)
canvas.addEventListener('touchstart', (e) => { startDrawing(e); }, {passive: false});
canvas.addEventListener('touchmove', (e) => { draw(e); }, {passive: false});
canvas.addEventListener('touchend', stopDrawing);

socket.on('draw', (data) => {
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
});

// (Keep your chat and clear button code below this...)

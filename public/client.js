const socket = io();
const canvas = document.getElementById('drawingBoard');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = 600;
canvas.height = 500;

let drawing = false;
let color = '#000000';
let room = null;
let username = null;

// --- LOGIN LOGIC ---
function joinGame() {
    const urlParams = new URLSearchParams(window.location.search);
    room = urlParams.get('room') || 'default';
    username = document.getElementById('username').value;

    if (!username) return alert("Please enter a name!");

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';

    socket.emit('joinRoom', { room, username });
}

// --- DRAWING LOGIC ---
canvas.addEventListener('mousedown', () => { drawing = true; });
canvas.addEventListener('mouseup', () => { drawing = false; ctx.beginPath(); });
canvas.addEventListener('mousemove', draw);

function draw(e) {
    if (!drawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Draw locally
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = document.getElementById('colorPicker').value;
    
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);

    // Send to server
    socket.emit('draw', { x, y, color: ctx.strokeStyle });
}

// Receive drawing from others
socket.on('draw', (data) => {
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = data.color;
    
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(data.x, data.y);
});

// Clear Board
function clearBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('clearCanvas');
}

socket.on('clearCanvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// --- CHAT / GUESSING LOGIC ---
const chatInput = document.getElementById('chatInput');
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const msg = chatInput.value;
        socket.emit('chatMessage', msg);
        chatInput.value = '';
    }
});

socket.on('chatMessage', (data) => {
    const msgDiv = document.getElementById('messages');
    const p = document.createElement('p');
    p.innerHTML = `<strong>${data.user}:</strong> ${data.text}`;
    msgDiv.appendChild(p);
    msgDiv.scrollTop = msgDiv.scrollHeight;
});

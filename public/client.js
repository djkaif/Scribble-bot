const socket = io();
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let canDraw = false;
let drawing = false;

canvas.width = window.innerWidth * 0.7;
canvas.height = window.innerHeight;

function join() {
    const params = new URLSearchParams(location.search);
    socket.emit("join", {
        room: params.get("room"),
        code: document.getElementById("code").value
    });
}

socket.on("role", data => {
    document.getElementById("login").hidden = true;
    document.getElementById("game").hidden = false;
    canDraw = data.drawer;
});

function pos(e) {
    const r = canvas.getBoundingClientRect();
    return {
        x: e.clientX - r.left,
        y: e.clientY - r.top
    };
}

canvas.onmousedown = e => {
    if (!canDraw) return;
    drawing = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    socket.emit("startPath", p);
};

canvas.onmousemove = e => {
    if (!drawing) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    socket.emit("draw", p);
};

canvas.onmouseup = () => {
    drawing = false;
    socket.emit("endPath");
};

socket.on("startPath", p => {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
});
socket.on("draw", p => {
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
});

const socket = io();
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let canDraw = false;
let drawing = false;

canvas.width = window.innerWidth * 0.7;
canvas.height = window.innerHeight * 0.8;

function join() {
    socket.emit("join", {
        room: new URLSearchParams(location.search).get("room"),
        code: document.getElementById("code").value
    });
}

socket.on("init", data => {
    document.getElementById("login").hidden = true;
    document.getElementById("game").hidden = false;
    canDraw = data.drawer;
    updatePlayers(data.players);
});

socket.on("players", updatePlayers);

function updatePlayers(players) {
    document.getElementById("players").innerHTML =
        players.map(p => `<div>${p.name}</div>`).join("");
}

function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
}

canvas.addEventListener("pointerdown", e => {
    if (!canDraw) return;
    drawing = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    socket.emit("startPath", p);
});

canvas.addEventListener("pointermove", e => {
    if (!drawing) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    socket.emit("draw", p);
});

canvas.addEventListener("pointerup", () => {
    drawing = false;
    socket.emit("endPath");
});

document.getElementById("msg").onkeydown = e => {
    if (e.key === "Enter") {
        socket.emit("chat", e.target.value);
        e.target.value = "";
    }
};

socket.on("chat", d => {
    document.getElementById("chat").innerHTML += `<div>${d.user}: ${d.text}</div>`;
});

socket.on("system", d => {
    document.getElementById("chat").innerHTML += `<div>${d.text}</div>`;
});

socket.on("timer", t => {
    document.getElementById("bar").style.width = `${(t / 90) * 100}%`;
});

socket.on("hint", h => {
    document.getElementById("chat").innerHTML += `<div>💡 ${h}</div>`;
});

function voteSkip() {
    socket.emit("voteSkip");
}

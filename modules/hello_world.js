// =====================================================================
// MODULE: Hello World & Fireworks Easter Egg
// =====================================================================

window.helloWorldPopup = function (isChecked) {
    const CONTAINER_ID = "hello_world_container";
    let container = document.getElementById(CONTAINER_ID);

    // ---------------------------------------------------------
    // 1. STATE MANAGEMENT & BULLETPROOF CLEANUP
    // ---------------------------------------------------------
    if (!isChecked) {
        if (container) container.remove();
        if (window.helloWorldAnimFrame) cancelAnimationFrame(window.helloWorldAnimFrame);

        const cb = document.getElementById("helloWorld");
        if (cb && cb.checked) cb.checked = false;
        return;
    }

    if (container) return; // Prevent duplicates

    // ---------------------------------------------------------
    // 2. CREATE UI CONTAINER & GLOWING TEXT
    // ---------------------------------------------------------
    container = document.createElement("div");
    container.id = CONTAINER_ID;
    container.setAttribute("data-extension-ui", "true");

    // pointer-events: none ensures the fireworks don't block you from clicking the website!
    Object.assign(container.style, {
        position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh",
        zIndex: "99999", pointerEvents: "none", overflow: "hidden",
        display: "flex", justifyContent: "center", alignItems: "center",
        background: "rgba(0, 0, 0, 0.4)" // Slight dimming of the website behind it
    });

    // Glowing, animated text
    const textNode = document.createElement("h1");
    textNode.innerText = "HELLO WORLD!";
    Object.assign(textNode.style, {
        color: "#fff", fontSize: "10vw", fontFamily: "system-ui, sans-serif",
        fontWeight: "900", letterSpacing: "5px", textShadow: "0 0 20px #fff, 0 0 40px #0ff, 0 0 80px #00f",
        zIndex: "2", margin: "0", textAlign: "center"
    });

    // Add a quick pulse animation to the text
    const styleBlock = document.createElement("style");
    styleBlock.innerText = `
        @keyframes hw-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        #hello_world_container h1 { animation: hw-pulse 2s infinite ease-in-out; }
    `;

    // ---------------------------------------------------------
    // 3. CANVAS FIREWORKS ENGINE
    // ---------------------------------------------------------
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", top: "0", left: "0", width: "100%", height: "100%", zIndex: "1" });

    container.appendChild(styleBlock);
    container.appendChild(canvas);
    container.appendChild(textNode);
    document.body.appendChild(container);

    const ctx = canvas.getContext("2d");
    let width, height;
    let particles = [];

    const resize = () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    resize();

    class Particle {
        constructor(x, y, color) {
            this.x = x; this.y = y;
            this.color = color;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.life = 1.0;
            this.decay = Math.random() * 0.02 + 0.015;
            this.size = Math.random() * 3 + 1;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vy += 0.05; // Gravity
            this.life -= this.decay;
        }
        draw() {
            ctx.globalAlpha = this.life;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const colors = ["#ff0044", "#00ff88", "#0088ff", "#ffdd00", "#ff00ff"];

    const createExplosion = (x, y) => {
        const color = colors[Math.floor(Math.random() * colors.length)];
        for (let i = 0; i < 50; i++) particles.push(new Particle(x, y, color));
    };

    const loop = () => {
        ctx.clearRect(0, 0, width, height); // Clear frame

        // Randomly spawn new fireworks
        if (Math.random() < 0.05) {
            createExplosion(Math.random() * width, Math.random() * (height / 2));
        }

        particles.forEach((p, index) => {
            p.update();
            p.draw();
            if (p.life <= 0) particles.splice(index, 1);
        });

        // Store the frame ID so we can cancel it if the user unchecks the box!
        window.helloWorldAnimFrame = requestAnimationFrame(loop);
    };

    loop(); // Start the engine
};
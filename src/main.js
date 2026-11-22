// =============================================================
// Smille God — Prototipo web · Etapa 0
// Objetivo: comprobar que Phaser funciona en el PC y en el celular.
// Toca (o haz clic) en cualquier parte: el héroe se mueve hacia ahí.
// =============================================================

// Una "escena" en Phaser es una pantalla del juego (menú, arena, derrota...).
// Toda escena puede tener tres funciones principales:
//   preload() → cargar imágenes y sonidos (aún no usamos ninguno)
//   create()  → crear los objetos UNA vez, al empezar
//   update()  → se ejecuta ~60 veces por segundo: el "bucle de juego"
class EscenaPrueba extends Phaser.Scene {
  constructor() {
    super('EscenaPrueba'); // nombre interno de la escena
  }

  create() {
    const ancho = this.scale.width;
    const alto = this.scale.height;

    // Título del juego, centrado arriba
    this.add.text(ancho / 2, 80, 'Smille God', {
      fontFamily: 'Georgia, serif',
      fontSize: '64px',
      color: '#f5c542', // dorado, como el Inty
    }).setOrigin(0.5); // 0.5 = el punto de anclaje es el centro del texto

    this.add.text(ancho / 2, 140, 'Etapa 0 · el entorno funciona', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#9fb3c8',
    }).setOrigin(0.5);

    // El "héroe": por ahora, un simple círculo
    this.heroe = this.add.circle(ancho / 2, alto / 2 + 60, 28, 0x4fc3f7);
    this.destino = new Phaser.Math.Vector2(this.heroe.x, this.heroe.y);

    // Velocidad en píxeles por segundo. En la Etapa 2 este número
    // pasará al archivo balance.json (principio "basado en datos").
    this.velocidad = 320;

    // Al tocar la pantalla, guardamos el punto como nuevo destino
    this.input.on('pointerdown', (puntero) => {
      this.destino.set(puntero.x, puntero.y);
      // Pequeño "juice": el héroe crece un instante al recibir la orden
      this.tweens.add({ targets: this.heroe, scale: 1.25, duration: 80, yoyo: true });
    });

    // Texto de ayuda abajo
    this.add.text(ancho / 2, alto - 50, 'Toca la pantalla para mover al héroe', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
    }).setOrigin(0.5);
  }

  // delta = milisegundos desde el frame anterior (~16 ms a 60 FPS).
  // Multiplicar por delta hace que el héroe se mueva igual de rápido
  // en un celular lento que en uno rápido.
  update(tiempo, delta) {
    const distancia = Phaser.Math.Distance.Between(
      this.heroe.x, this.heroe.y, this.destino.x, this.destino.y
    );
    const paso = this.velocidad * (delta / 1000);

    if (distancia <= paso) {
      // Llegó: lo dejamos exactamente en el destino
      this.heroe.setPosition(this.destino.x, this.destino.y);
    } else {
      // Avanza un "paso" en dirección al destino
      const angulo = Phaser.Math.Angle.Between(
        this.heroe.x, this.heroe.y, this.destino.x, this.destino.y
      );
      this.heroe.x += Math.cos(angulo) * paso;
      this.heroe.y += Math.sin(angulo) * paso;
    }
  }
}

// Configuración general del juego
const config = {
  type: Phaser.AUTO,          // usa WebGL si el equipo lo soporta; si no, Canvas
  backgroundColor: '#0b0f1a',
  scale: {
    mode: Phaser.Scale.FIT,   // se adapta a la pantalla sin deformarse
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,              // resolución "lógica" horizontal (celular acostado)
    height: 720,
  },
  scene: [EscenaPrueba],
};

// Esta línea arranca el juego
new Phaser.Game(config);

// -------------------------------------------------------------
// Pantalla completa y orientación horizontal
// -------------------------------------------------------------
// Los navegadores solo permiten la pantalla completa como respuesta
// a un toque del jugador; por eso se pide desde un botón o un toque.
// "async" permite esperar (await) a que el navegador responda.
async function pedirPantallaCompleta() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
    // Fijar en horizontal: funciona en Android (Chrome), no en iPhone.
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape');
    }
  } catch (error) {
    // Si el navegador no lo permite, el juego sigue funcionando igual.
    console.log('Pantalla completa no disponible:', error.message);
  }
}

// Botón del aviso "Gira tu celular"
document.getElementById('boton-jugar').addEventListener('click', pedirPantallaCompleta);

// Si el jugador giró el celular a mano, el primer toque también activa la pantalla completa
document.addEventListener('pointerup', pedirPantallaCompleta, { once: true });

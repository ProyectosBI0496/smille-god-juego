// =============================================================
// Red (Etapa 9, D-024): conexión directa entre dos celulares
//
// Usamos PeerJS (cargado en index.html), que se apoya en WebRTC:
//   1. El ANFITRIÓN crea una "sala" con un código de 4 números.
//      Por dentro, su identificador es "smillegod-sala-XXXX".
//   2. El INVITADO escribe el código y se conecta a ese identificador.
//   3. Un servidor gratuito de PeerJS solo los PRESENTA; después los
//      datos viajan directo de un celular al otro.
//
// Los mensajes son objetos con un campo "t" (tipo), por ejemplo
//   { t: 'estado', ... }  o  { t: 'hab', h: 'atq' }
// Esta clase los reparte como eventos: red.on('estado', funcion).
// =============================================================

const PREFIJO = 'smillegod-sala-';
let actual = null; // la conexión activa (solo hay una a la vez)

/** La conexión activa, o null si se juega solo */
export function redActual() {
  return actual;
}

export default class Red extends Phaser.Events.EventEmitter {
  constructor() {
    super();
    if (actual) actual.cerrar();
    actual = this;
    this.peer = null;
    this.con = null;
    this.esAnfitrion = false;
    this.razaCompanero = 'humano';
    this.nickCompanero = '';
    this.ultimoMensaje = 0; // cuándo llegó el último mensaje (para saber si se cortó)
  }

  /** ANFITRIÓN: crea la sala. alListo(codigo) se llama cuando ya se puede compartir el código */
  crearSala(alListo, alError, intentos = 0) {
    this.esAnfitrion = true;
    const codigo = String(Phaser.Math.Between(1000, 9999));
    this.peer = new Peer(PREFIJO + codigo);
    this.peer.on('open', () => alListo(codigo));
    this.peer.on('connection', (con) => {
      if (this.con) { con.close(); return; } // la sala es solo para 2
      this.prepararConexion(con);
    });
    this.peer.on('error', (error) => {
      // Si ese código ya lo usa otra sala, probamos con otro número
      if (error.type === 'unavailable-id' && intentos < 5) {
        this.peer.destroy();
        this.crearSala(alListo, alError, intentos + 1);
      } else {
        alError(error);
      }
    });
  }

  /** INVITADO: se une a la sala del código */
  unirse(codigo, alError) {
    this.esAnfitrion = false;
    this.peer = new Peer();
    this.peer.on('open', () => {
      this.prepararConexion(this.peer.connect(PREFIJO + codigo, { reliable: true }));
    });
    this.peer.on('error', (error) => alError(error));
  }

  prepararConexion(con) {
    this.con = con;
    con.on('open', () => this.emit('conectado'));
    con.on('data', (mensaje) => {
      if (!mensaje || !mensaje.t) return;
      this.ultimoMensaje = performance.now();
      // La raza del compañero se guarda siempre, esté en la escena que esté
      if (mensaje.t === 'hola' || mensaje.t === 'raza') {
        this.razaCompanero = mensaje.raza;
        this.nickCompanero = String(mensaje.nick || '').slice(0, 12);
      }
      this.emit(mensaje.t, mensaje);
    });
    con.on('close', () => this.emit('desconectado'));
  }

  get conectado() {
    return !!(this.con && this.con.open);
  }

  enviar(mensaje) {
    if (this.conectado) this.con.send(mensaje);
  }

  /**
   * Escucha un tipo de mensaje mientras la escena esté abierta.
   * Al cerrarse la escena, se deja de escuchar solo (evita avisos repetidos).
   */
  escuchar(escena, tipo, funcion) {
    this.on(tipo, funcion, escena);
    escena.events.once('shutdown', () => this.off(tipo, funcion, escena));
  }

  cerrar() {
    if (this.con) this.con.close();
    if (this.peer && !this.peer.destroyed) this.peer.destroy();
    this.removeAllListeners();
    if (actual === this) actual = null;
  }
}

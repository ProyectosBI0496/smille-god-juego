// =============================================================
// Guía "Cómo se juega" (v0.1.15)
// El TEXTO de cada página de la guía. Para cambiar la guía basta con
// editar este archivo (no hace falta tocar la escena que la dibuja).
// Recibe "b" (balance.json) para que los números salgan de los datos:
// si cambias, por ejemplo, los puntos por nivel, la guía se actualiza sola.
// Cada página: { titulo, icono, texto }. En el texto, cada "\n" es un salto de línea.
// =============================================================

export function paginasGuia(b) {
  const pct = (n) => `${String(Math.round(n * 1000) / 10).replace('.', ',')}%`; // 0.005 → "0,5%"
  const dificultades = b.dificultades.lista.map((d) => d.nombre).join(', ');
  const estadisticas = Object.values(b.estadisticas.lista).map((e) => `• ${e.nombre}: ${e.texto}`).join('\n');

  return [
    {
      titulo: 'El objetivo',
      icono: '⚔',
      texto:
        'Cada mundo es una MAZMORRA de salas unidas por pasillos.\n\n'
        + '• Entra a una sala y se cierran las rejas: vence todas las OLEADAS de monstruos para abrirlas.\n'
        + '• Al final te esperan los JEFES. Vence a todos y superas el mundo.\n'
        + `• Cada mundo tiene ${b.dificultades.lista.length} dificultades (estrellas ★): ${dificultades}.\n`
        + `• El mundo siguiente se abre al conseguir las ${b.dificultades.lista.length} ★ del anterior.\n`
        + '• Al ganar puedes seguir a la dificultad siguiente con la vida que te quedó.',
    },
    {
      titulo: 'Controles',
      icono: '🎮',
      texto:
        '• JOYSTICK (lado izquierdo de la pantalla): mueve a tu héroe.\n'
        + '• BOTÓN GRANDE (abajo a la derecha): tu ataque.\n'
        + '• Los otros 2 botones son PODERES: cuestan maná (número azul) y tardan en recargarse. '
        + `Se abren en los niveles ${b.progreso.nivelBotones.slice(1).join(' y ')}.\n`
        + '• ✦ PASIVA: siempre está activa. Tócala para leer qué hace.\n'
        + '• POCIONES de vida (roja) y de maná (azul): úsalas cuando las necesites.\n'
        + '• Las dos barras arriba a la derecha: PAUSA.\n\n'
        + 'En el PC: WASD o flechas mueven · ESPACIO ataque · K y L poderes · H y M pociones · P pausa.',
    },
    {
      titulo: 'Vida y maná',
      icono: '❤',
      texto:
        '• Barra VERDE sobre el héroe = vida. Barra AZUL = maná.\n'
        + `• Si nadie te golpea por ${b.regenVida.sinDanioMs / 1000} segundos, recuperas ${pct(b.regenVida.porSegundo)} de vida `
        + `y ${pct(b.mana.regenPorSegundo)} de maná por segundo.\n`
        + `• Al vencer una sala recuperas ${b.oleadas.curacionPorSala} de vida.\n`
        + '• Números ROJOS = daño que recibes. AMARILLOS = daño que haces.\n'
        + '• Cuidado con los monstruos que tienen 💫 (te ATURDEN: no te mueves ni usas poderes) '
        + 'o 🕸️ (te AMARRAN: no te mueves, pero sí atacas). El anuncio de cada oleada te avisa.',
    },
    {
      titulo: 'Tu héroe',
      icono: '🛡',
      texto:
        '• Tu héroe es una RAZA + una CLASE + un ROL (Tanque, DPS o Sanador). El rol decide tus poderes.\n'
        + `• SUBIR DE NIVEL cuesta fichas. Cada nivel te da ${b.progreso.puntosPorNivel} PUNTOS: `
        + 'ponlos en la estadística que quieras con el botón +.\n\n'
        + estadisticas,
    },
    {
      titulo: 'Equipo y premios',
      icono: '💰',
      texto:
        '• En la TIENDA compras equipo para tus espacios (armas, ropa y accesorios) con intys o rubís.\n'
        + '• Hay sets: Básico, Moderno y God. Llevar 4 u 8 piezas del mismo set da un BONO extra '
        + '(con 8 piezas God, tu héroe brilla con un aura dorada).\n'
        + '• Cada jefe vencido y cada mundo superado dan un COFRE: monedas, rubís o equipo.\n'
        + '• Ganar da CORONAS 👑, que suben tu RANGO y abren héroes nuevos. Perder quita coronas.\n'
        + '• ¡Ojo! Salir al mapa, reiniciar o cerrar el juego en plena partida cuenta como PERDIDA.',
    },
    {
      titulo: 'Jugar en grupo',
      icono: '👥',
      texto:
        '• En la pantalla de título toca "Jugar en grupo".\n'
        + '• Uno CREA la sala y comparte el CÓDIGO que aparece. Los demás se UNEN con ese código (hasta 3 jugadores).\n'
        + '• El que creó la sala elige el mundo y la dificultad.\n'
        + '• En grupo salen más monstruos y son más fuertes: ¡repártanse los roles! '
        + 'El Tanque aguanta, el DPS hace daño y el Sanador cura.\n'
        + '• Si caes, quedas como fantasma y te levantas al vencer la sala. Solo se pierde si caen todos.\n'
        + '• Arriba a la izquierda ves la vida ❤ y el maná ✦ de tus compañeros.\n'
        + '• Todos deben tener la pantalla encendida y el juego abierto.',
    },
  ];
}

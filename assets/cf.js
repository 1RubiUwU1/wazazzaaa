const fs = require('fs');

// Leer el archivo y parsear JSON
const rawData = fs.readFileSync('config.json');
const config = JSON.parse(rawData);

// Acceder a los datos
const nombre = config.bot.nombre;
const bateriaIp = config.ports.bateria;
const encriptado = config.sys.encrip;
const gml = config.sys.GML;
const password = config.sys.PASS;

// Mostrar los valores
console.log("Nombre del bot:", nombre);
console.log("IP de batería:", bateriaIp);
console.log("¿Encriptado?:", encriptado);
console.log("GML:", gml);
console.log("Contraseña:", password);

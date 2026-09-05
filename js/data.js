// Catálogo de las 49 selecciones del Mundial 2026, copiado literalmente del prototipo.
// c = código de 3 letras, n = nombre, g = grupo ("★" para especiales), f = bandera emoji, t = nº de figuritas.
export const TEAMS = [
 {c:"FWC",n:"Especiales Copa del Mundo",g:"★",f:"🏆",t:18},
 {c:"MEX",n:"México",g:"A",f:"🇲🇽"},{c:"RSA",n:"Sudáfrica",g:"A",f:"🇿🇦"},{c:"KOR",n:"Corea del Sur",g:"A",f:"🇰🇷"},{c:"CZE",n:"Rep. Checa",g:"A",f:"🇨🇿"},
 {c:"CAN",n:"Canadá",g:"B",f:"🇨🇦"},{c:"BIH",n:"Bosnia y Herzegovina",g:"B",f:"🇧🇦"},{c:"QAT",n:"Catar",g:"B",f:"🇶🇦"},{c:"SUI",n:"Suiza",g:"B",f:"🇨🇭"},
 {c:"BRA",n:"Brasil",g:"C",f:"🇧🇷"},{c:"MAR",n:"Marruecos",g:"C",f:"🇲🇦"},{c:"HAI",n:"Haití",g:"C",f:"🇭🇹"},{c:"SCO",n:"Escocia",g:"C",f:"🏴󠁧󠁢󠁳󠁣󠁴󠁿"},
 {c:"USA",n:"Estados Unidos",g:"D",f:"🇺🇸"},{c:"PAR",n:"Paraguay",g:"D",f:"🇵🇾"},{c:"AUS",n:"Australia",g:"D",f:"🇦🇺"},{c:"TUR",n:"Turquía",g:"D",f:"🇹🇷"},
 {c:"GER",n:"Alemania",g:"E",f:"🇩🇪"},{c:"CUW",n:"Curazao",g:"E",f:"🇨🇼"},{c:"CIV",n:"Costa de Marfil",g:"E",f:"🇨🇮"},{c:"ECU",n:"Ecuador",g:"E",f:"🇪🇨"},
 {c:"NED",n:"Países Bajos",g:"F",f:"🇳🇱"},{c:"JPN",n:"Japón",g:"F",f:"🇯🇵"},{c:"SWE",n:"Suecia",g:"F",f:"🇸🇪"},{c:"TUN",n:"Túnez",g:"F",f:"🇹🇳"},
 {c:"BEL",n:"Bélgica",g:"G",f:"🇧🇪"},{c:"EGY",n:"Egipto",g:"G",f:"🇪🇬"},{c:"IRN",n:"Irán",g:"G",f:"🇮🇷"},{c:"NZL",n:"Nueva Zelanda",g:"G",f:"🇳🇿"},
 {c:"ESP",n:"España",g:"H",f:"🇪🇸"},{c:"CPV",n:"Cabo Verde",g:"H",f:"🇨🇻"},{c:"KSA",n:"Arabia Saudita",g:"H",f:"🇸🇦"},{c:"URU",n:"Uruguay",g:"H",f:"🇺🇾"},
 {c:"FRA",n:"Francia",g:"I",f:"🇫🇷"},{c:"SEN",n:"Senegal",g:"I",f:"🇸🇳"},{c:"IRQ",n:"Irak",g:"I",f:"🇮🇶"},{c:"NOR",n:"Noruega",g:"I",f:"🇳🇴"},
 {c:"ARG",n:"Argentina",g:"J",f:"🇦🇷"},{c:"ALG",n:"Argelia",g:"J",f:"🇩🇿"},{c:"AUT",n:"Austria",g:"J",f:"🇦🇹"},{c:"JOR",n:"Jordania",g:"J",f:"🇯🇴"},
 {c:"POR",n:"Portugal",g:"K",f:"🇵🇹"},{c:"COD",n:"R.D. Congo",g:"K",f:"🇨🇩"},{c:"UZB",n:"Uzbekistán",g:"K",f:"🇺🇿"},{c:"COL",n:"Colombia",g:"K",f:"🇨🇴"},
 {c:"ENG",n:"Inglaterra",g:"L",f:"🏴󠁧󠁢󠁥󠁮󠁧󠁿"},{c:"CRO",n:"Croacia",g:"L",f:"🇭🇷"},{c:"GHA",n:"Ghana",g:"L",f:"🇬🇭"},{c:"PAN",n:"Panamá",g:"L",f:"🇵🇦"}
].map(t=>({...t,t:t.t||20}));

export const TOTAL_STICKERS = TEAMS.reduce((a,t)=>a+t.t,0);

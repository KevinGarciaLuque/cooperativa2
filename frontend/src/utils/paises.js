// Códigos telefónicos para el registro. Honduras es el predeterminado; los "frecuentes"
// (donde más viven hondureños) salen primero en la lista y el resto en orden alfabético.
// Formato: "ISO|Nombre|código|dígitos" — dígitos = largo del número sin el código
// (vacío cuando varía; entonces se aceptan de 6 a 12).

const FRECUENTES = [
  "HN|Honduras|504|8",
  "US|Estados Unidos|1|10",
  "CA|Canadá|1|10",
  "ES|España|34|9",
  "MX|México|52|10",
  "GT|Guatemala|502|8",
  "SV|El Salvador|503|8",
  "NI|Nicaragua|505|8",
  "CR|Costa Rica|506|8",
  "PA|Panamá|507|8",
  "BZ|Belice|501|7",
  "IT|Italia|39|",
  "CO|Colombia|57|10",
];

const RESTO = [
  "AF|Afganistán|93|9", "AL|Albania|355|9", "DE|Alemania|49|", "AD|Andorra|376|6", "AO|Angola|244|9",
  "AG|Antigua y Barbuda|1268|7", "SA|Arabia Saudita|966|9", "DZ|Argelia|213|9", "AR|Argentina|54|10",
  "AM|Armenia|374|8", "AW|Aruba|297|7", "AU|Australia|61|9", "AT|Austria|43|", "AZ|Azerbaiyán|994|9",
  "BS|Bahamas|1242|7", "BH|Baréin|973|8", "BD|Bangladés|880|10", "BB|Barbados|1246|7", "BE|Bélgica|32|9",
  "BJ|Benín|229|", "BM|Bermudas|1441|7", "BY|Bielorrusia|375|9", "BO|Bolivia|591|8",
  "BA|Bosnia y Herzegovina|387|", "BW|Botsuana|267|8", "BR|Brasil|55|11", "BN|Brunéi|673|7",
  "BG|Bulgaria|359|", "BF|Burkina Faso|226|8", "BI|Burundi|257|8", "BT|Bután|975|8", "CV|Cabo Verde|238|7",
  "KH|Camboya|855|", "CM|Camerún|237|9", "QA|Catar|974|8", "TD|Chad|235|8", "CL|Chile|56|9", "CN|China|86|11",
  "CY|Chipre|357|8", "KM|Comoras|269|7", "CG|Congo|242|9", "KP|Corea del Norte|850|", "KR|Corea del Sur|82|",
  "CI|Costa de Marfil|225|10", "HR|Croacia|385|", "CU|Cuba|53|8", "CW|Curazao|599|7", "DK|Dinamarca|45|8",
  "DM|Dominica|1767|7", "EC|Ecuador|593|9", "EG|Egipto|20|10", "AE|Emiratos Árabes Unidos|971|9",
  "ER|Eritrea|291|7", "SK|Eslovaquia|421|9", "SI|Eslovenia|386|8", "EE|Estonia|372|", "SZ|Esuatini|268|8",
  "ET|Etiopía|251|9", "PH|Filipinas|63|10", "FI|Finlandia|358|", "FJ|Fiyi|679|7", "FR|Francia|33|9",
  "GA|Gabón|241|", "GM|Gambia|220|7", "GE|Georgia|995|9", "GH|Ghana|233|9", "GI|Gibraltar|350|8",
  "GD|Granada|1473|7", "GR|Grecia|30|10", "GL|Groenlandia|299|6", "GP|Guadalupe|590|9", "GU|Guam|1671|7",
  "GF|Guayana Francesa|594|9", "GN|Guinea|224|9", "GQ|Guinea Ecuatorial|240|9", "GW|Guinea-Bisáu|245|",
  "GY|Guyana|592|7", "HT|Haití|509|8", "HK|Hong Kong|852|8", "HU|Hungría|36|9", "IN|India|91|10",
  "ID|Indonesia|62|", "IQ|Irak|964|10", "IR|Irán|98|10", "IE|Irlanda|353|9", "IS|Islandia|354|7",
  "KY|Islas Caimán|1345|7", "MH|Islas Marshall|692|7", "SB|Islas Salomón|677|7",
  "TC|Islas Turcas y Caicos|1649|7", "VG|Islas Vírgenes Británicas|1284|7",
  "VI|Islas Vírgenes de EE. UU.|1340|7", "IL|Israel|972|9", "JM|Jamaica|1876|7", "JP|Japón|81|10",
  "JO|Jordania|962|9", "KZ|Kazajistán|7|10", "KE|Kenia|254|9", "KG|Kirguistán|996|9", "KI|Kiribati|686|",
  "XK|Kosovo|383|", "KW|Kuwait|965|8", "LA|Laos|856|", "LS|Lesoto|266|8", "LV|Letonia|371|8", "LB|Líbano|961|",
  "LR|Liberia|231|", "LY|Libia|218|9", "LI|Liechtenstein|423|7", "LT|Lituania|370|8", "LU|Luxemburgo|352|",
  "MO|Macao|853|8", "MK|Macedonia del Norte|389|8", "MG|Madagascar|261|9", "MY|Malasia|60|", "MW|Malaui|265|9",
  "MV|Maldivas|960|7", "ML|Malí|223|8", "MT|Malta|356|8", "MA|Marruecos|212|9", "MQ|Martinica|596|9",
  "MU|Mauricio|230|8", "MR|Mauritania|222|8", "FM|Micronesia|691|7", "MD|Moldavia|373|8", "MC|Mónaco|377|",
  "MN|Mongolia|976|8", "ME|Montenegro|382|", "MZ|Mozambique|258|9", "MM|Myanmar|95|", "NA|Namibia|264|9",
  "NR|Nauru|674|7", "NP|Nepal|977|10", "NE|Níger|227|8", "NG|Nigeria|234|10", "NO|Noruega|47|8",
  "NC|Nueva Caledonia|687|6", "NZ|Nueva Zelanda|64|", "OM|Omán|968|8", "NL|Países Bajos|31|9",
  "PK|Pakistán|92|10", "PW|Palaos|680|7", "PS|Palestina|970|9", "PG|Papúa Nueva Guinea|675|8",
  "PY|Paraguay|595|9", "PE|Perú|51|9", "PF|Polinesia Francesa|689|8", "PL|Polonia|48|9", "PT|Portugal|351|9",
  "PR|Puerto Rico|1|10", "GB|Reino Unido|44|10", "CF|República Centroafricana|236|8",
  "CZ|República Checa|420|9", "CD|República Democrática del Congo|243|9", "DO|República Dominicana|1|10",
  "RE|Reunión|262|9", "RW|Ruanda|250|9", "RO|Rumania|40|9", "RU|Rusia|7|10", "WS|Samoa|685|",
  "KN|San Cristóbal y Nieves|1869|7", "SM|San Marino|378|", "VC|San Vicente y las Granadinas|1784|7",
  "LC|Santa Lucía|1758|7", "ST|Santo Tomé y Príncipe|239|7", "SN|Senegal|221|9", "RS|Serbia|381|",
  "SC|Seychelles|248|7", "SL|Sierra Leona|232|8", "SG|Singapur|65|8", "SX|Sint Maarten|1721|7", "SY|Siria|963|9",
  "SO|Somalia|252|", "LK|Sri Lanka|94|9", "ZA|Sudáfrica|27|9", "SD|Sudán|249|9", "SS|Sudán del Sur|211|9",
  "SE|Suecia|46|", "CH|Suiza|41|9", "SR|Surinam|597|7", "TH|Tailandia|66|9", "TW|Taiwán|886|9",
  "TZ|Tanzania|255|9", "TJ|Tayikistán|992|9", "TL|Timor Oriental|670|8", "TG|Togo|228|8", "TO|Tonga|676|",
  "TT|Trinidad y Tobago|1868|7", "TN|Túnez|216|8", "TM|Turkmenistán|993|8", "TR|Turquía|90|10",
  "TV|Tuvalu|688|", "UA|Ucrania|380|9", "UG|Uganda|256|9", "UY|Uruguay|598|8", "UZ|Uzbekistán|998|9",
  "VU|Vanuatu|678|7", "VE|Venezuela|58|10", "VN|Vietnam|84|9", "YE|Yemen|967|9", "DJ|Yibuti|253|8",
  "ZM|Zambia|260|9", "ZW|Zimbabue|263|9",
];

// Bandera a partir del código ISO (letras indicadoras regionales)
const bandera = (iso) => String.fromCodePoint(...[...iso].map((c) => 0x1f1a5 + c.charCodeAt(0)));

const crear = (fila, frecuente) => {
  const [iso, nombre, codigo, d] = fila.split("|");
  const digitos = d ? Number(d) : null;
  return {
    clave: iso,
    nombre,
    codigo,
    bandera: bandera(iso),
    frecuente,
    minimo: digitos || 6,
    maximo: digitos || 12,
  };
};

const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, "es");
export const PAISES_TEL = [...FRECUENTES.map((f) => crear(f, true)), ...RESTO.map((f) => crear(f, false)).sort(porNombre)];

export const PAIS_PREDETERMINADO = PAISES_TEL[0];

// Ayuda bajo el campo: "8 dígitos." / "Entre 6 y 12 dígitos, sin el código del país."
export const ayudaTelefono = (pais) => {
  const largo = pais.minimo === pais.maximo ? `${pais.minimo} dígitos` : `Entre ${pais.minimo} y ${pais.maximo} dígitos`;
  return pais.codigo === "504" ? `${largo}.` : `${largo}, sin el código del país.`;
};

// Búsqueda sin tildes ni mayúsculas, por nombre o por código ("+44", "44", "reino")
const normalizar = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export const buscarPaises = (texto) => {
  const q = normalizar(texto);
  if (!q) return PAISES_TEL;
  const cod = q.replace(/^\+/, "");
  return PAISES_TEL.filter((p) => normalizar(p.nombre).includes(q) || (/^\d+$/.test(cod) && p.codigo.startsWith(cod)));
};

// Número como se guarda: Honduras sin código (8 dígitos); otros países con "+código"
export const telefonoCompleto = (pais, digitos) => (pais.codigo === "504" ? digitos : `+${pais.codigo}${digitos}`);

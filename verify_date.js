const dateStr = "2025-12-30 20:03:53";
const parsed = new Date(dateStr);
const target = new Date();

console.log("Input:", dateStr);
console.log("Parsed:", parsed.toString());
console.log("Is Valid:", !isNaN(parsed.getTime()));

const dateStrISO = dateStr.replace(' ', 'T');
const parsedISO = new Date(dateStrISO);
console.log("Input ISO:", dateStrISO);
console.log("Parsed ISO:", parsedISO.toString());

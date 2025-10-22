// types/jspdf-autotable.d.ts
import 'jspdf';

interface AutoTableOptions {
  head?: any[];
  body?: any[];
  [key: string]: any; // Für weitere, nicht explizit definierte Optionen
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: AutoTableOptions) => jsPDF;
  }
}

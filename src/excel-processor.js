import * as XLSX from 'xlsx';

export const parseExcel = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                // Process headers and rows
                if (jsonData.length < 2) {
                    resolve({ headers: [], rows: [] });
                    return;
                }

                const headers = jsonData[0];
                const rows = jsonData.slice(1).map((row, index) => {
                    const rowObj = { id: Date.now() + index };
                    headers.forEach((header, i) => {
                        rowObj[header] = row[i] || '';
                    });
                    return rowObj;
                });

                resolve({ headers, rows });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
};

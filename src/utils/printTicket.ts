export interface ThermalTicketItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ThermalTicketData {
  companyName?: string;
  companyRuc?: string;
  companyAddress?: string;
  companyPhone?: string;
  branchName: string;
  warehouseName: string;
  invoiceNumber: string;
  date: string;
  clientName: string;
  clientDoc: string;
  items: ThermalTicketItem[];
  subtotal: number;
  tax: number;
  total: number;
  oilChangeData?: {
    vehiclePlate: string;
    vehicleBrand?: string;
    vehicleModel?: string;
    currentMileage: number;
    nextChangeMileage: number;
    oilType?: string;
  };
}

export const printThermalTicket = (data: ThermalTicketData) => {
  const printWindow = window.open('', '_blank', 'width=380,height=600');
  if (!printWindow) return;

  const company = data.companyName || 'TALLER MECÁNICO';
  const ruc = data.companyRuc || '0999999999001';
  const address = data.companyAddress || 'Matriz Guayaquil';
  const phone = data.companyPhone || '0999999999';

  const itemsRows = data.items
    .map(item => {
      // Truncar nombre a 20 caracteres para mantener las 40 columnas exactas del ticket térmico
      const truncatedName = item.name.length > 20 ? item.name.substring(0, 19) + '…' : item.name;
      return `
        <tr>
          <td style="text-align: left; vertical-align: top; padding: 2px 0;">${item.quantity.toFixed(1)}</td>
          <td style="text-align: left; vertical-align: top; padding: 2px 4px; word-break: break-word;">${truncatedName}</td>
          <td style="text-align: right; vertical-align: top; padding: 2px 0;">${item.unitPrice.toFixed(2)}</td>
          <td style="text-align: right; vertical-align: top; padding: 2px 0; font-weight: bold;">${item.total.toFixed(2)}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Ticket ${data.invoiceNumber}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          @media print {
            html, body {
              width: 76mm !important;
              max-width: 76mm !important;
              margin: 0 auto !important;
              padding: 2mm 3mm !important;
            }
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            line-height: 1.25;
            color: #000;
            background: #fff;
            width: 270px;
            max-width: 270px;
            margin: 0 auto;
            padding: 8px 4px;
            box-sizing: border-box;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          .double-divider { border-top: 2px solid #000; margin: 6px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          .total-row { display: flex; justify-content: space-between; margin: 2px 0; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="bold" style="font-size: 14px; text-transform: uppercase;">${company}</div>
          <div style="font-size: 10px;">RUC: ${ruc}</div>
          <div style="font-size: 10px;">${address}</div>
          <div style="font-size: 10px;">TELF: ${phone}</div>
        </div>

        <div class="double-divider"></div>

        <div>
          <div><strong>COMPROBANTE :</strong> ${data.invoiceNumber}</div>
          <div><strong>FECHA       :</strong> ${data.date}</div>
          <div><strong>SUCURSAL    :</strong> ${data.branchName}</div>
          <div><strong>BODEGA      :</strong> ${data.warehouseName}</div>
        </div>

        <div class="divider"></div>

        <div>
          <div><strong>CLIENTE    :</strong> ${data.clientName}</div>
          <div><strong>RUC/CÉDULA :</strong> ${data.clientDoc}</div>
        </div>

        <div class="divider"></div>

        <table>
          <thead>
            <tr style="border-bottom: 1px dashed #000;">
              <th style="text-align: left; width: 35px; padding-bottom: 3px;">CANT</th>
              <th style="text-align: left; padding-bottom: 3px;">DESCRIPCIÓN</th>
              <th style="text-align: right; width: 45px; padding-bottom: 3px;">P.U</th>
              <th style="text-align: right; width: 50px; padding-bottom: 3px;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="divider"></div>

        <div class="total-row">
          <span>SUBTOTAL:</span>
          <span>$${data.subtotal.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>IVA:</span>
          <span>$${data.tax.toFixed(2)}</span>
        </div>
        <div class="divider"></div>
        <div class="total-row bold" style="font-size: 13px;">
          <span>TOTAL A PAGAR:</span>
          <span>$${data.total.toFixed(2)}</span>
        </div>
        <div class="double-divider"></div>

        ${data.oilChangeData ? `
          <div style="border: 1px solid #000; padding: 6px; margin: 6px 0; text-align: left;">
            <div class="text-center bold" style="font-size: 11px;">🚗 CONTROL DE CAMBIO DE ACEITE</div>
            <div class="divider"></div>
            <div><strong>VEHÍCULO :</strong> ${[data.oilChangeData.vehicleBrand, data.oilChangeData.vehicleModel].filter(Boolean).join(' ') || 'Vehículo'}</div>
            <div><strong>PLACA    :</strong> ${data.oilChangeData.vehiclePlate}</div>
            <div><strong>KM ACTUAL:</strong> ${data.oilChangeData.currentMileage.toLocaleString()} km</div>
            <div class="bold" style="font-size: 12px; margin: 3px 0;">
              PRÓXIMO: ${data.oilChangeData.nextChangeMileage.toLocaleString()} km
            </div>
            <div><strong>ACEITE   :</strong> ${data.oilChangeData.oilType || 'Sintético 5W-30'}</div>
          </div>
          <div class="divider"></div>
        ` : ''}

        <div class="text-center" style="font-size: 10px; margin-top: 8px;">
          <div class="bold">¡GRACIAS POR SU PREFERENCIA!</div>
          <div>Conserve este comprobante para cualquier reclamo o garantía.</div>
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
};

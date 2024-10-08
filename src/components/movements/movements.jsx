import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
//import { format, subDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import es from 'date-fns/locale/es'; // Importa el locale español si quieres que esté en español
import FilterMovements from './FilterMovements';
import '../../styles/AccountMovements.css';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

function AccountMovements() {
    const { accountNumber } = useParams(); // Obtén el número de cuenta de los parámetros
    const [movements, setMovements] = useState([]);
    const [accountBalance, setAccountBalance] = useState(0);
    const [accountOwner, setAccountOwner] = useState(localStorage.getItem("user_name") || ''); // Para el propietario de la cuenta
    const [filter, setFilter] = useState('15days'); // Para los filtros de fecha, por defecto '15days'
    const [startDate, setStartDate] = useState(null); // Para el filtro personalizado
    const [endDate, setEndDate] = useState(null); // Para el filtro personalizado
    const navigate = useNavigate();
    const pdfRef = useRef();

    useEffect(() => {
        const storedAccounts = JSON.parse(localStorage.getItem('accounts')) || [];
        const account = storedAccounts.find(acc => acc.account_number === parseInt(accountNumber));

        if (account) {
            setMovements(account.movements || []);
            setAccountBalance(account.balance || 0);
            setAccountOwner(localStorage.getItem("user_name") || ''); // Asigna el propietario de la cuenta desde localStorage
        }
    }, [accountNumber]);

    console.log("movementes ", movements)

    const handleFilterChange = (newFilter, start, end) => {
        setFilter(newFilter);
        setStartDate(start);
        setEndDate(end);
    };

    const handleReturn = () => {
        navigate("/dashboard");
    };

    // Helper function to format amounts with + or -
    const formatAmount = (amount) => (amount !== undefined && amount !== null)
        ? (amount >= 0 ? `+${amount.toFixed(2)}` : `${amount.toFixed(2)}`)
        : 'N/A';

    const calculateMovements = () => {
        let filteredMovements = movements;

        // Obtener la fecha de hoy y calcular el rango de 15 días atrás
        const today = new Date();
        const startOfToday = startOfDay(today);
        const endOfToday = endOfDay(today);

        if (filter === '15days') {
            const fifteenDaysAgo = subDays(startOfToday, 15);
            filteredMovements = movements.filter(movement =>
                isWithinInterval(new Date(movement.fecha_movimiento), { start: fifteenDaysAgo, end: endOfToday })
            );
        } else if (filter === 'month') {
            const start = startOfMonth(today);
            const end = endOfMonth(today);
            filteredMovements = movements.filter(movement =>
                isWithinInterval(new Date(movement.fecha_movimiento), { start: startOfDay(start), end: endOfDay(end) })
            );
        } else if (filter === 'custom') {
            if (startDate && endDate) {
                // Ajusta startDate y endDate a las 00:00 y 23:59 respectivamente
                const start = startOfDay(startDate);
                const end = endOfDay(endDate);
                filteredMovements = movements.filter(movement =>
                    isWithinInterval(new Date(movement.fecha_movimiento), { start, end })
                );
            }
        }

        const results = filteredMovements.map((movement) => {
            const date = format(new Date(movement.fecha_movimiento), 'EEEE, d MMMM yyyy', { locale: es });
            const isDeposit = movement.cuenta_origen === 0;

            // Verificación para cambiar el tipo de movimiento si el destino es 29417150
            let type;
            if (movement.Descripcion === "Pago de servicios básicos: Luz") {
                type = 'Pago Luz';
            }
            else if (movement.Descripcion === "Pago de servicios básicos: Agua") {
                type = 'Pago Agua';
            } else if (movement.Descripcion === "Pago de servicios básicos: Internet") {
                type = 'Pago Internet';
            } else if (movement.Descripcion === "Pago de servicios básicos: Telefonia fija") {
                type = 'Pago Telefonia fija';
            } else {
                type = isDeposit ? 'Depósito' : 'Transferencia';
            }

            // const accountInfo = isDeposit
            //     ? ''
            //     : movement.saldo_sale > 0
            //         ? `A la cuenta: ${movement.cuenta_destino}`
            //         : `Desde la cuenta: ${movement.cuenta_origen}`;

            // Cambia la lógica para accountInfo basado en el tipo de movimiento
            const accountInfo = type.startsWith('Pago') ? '' :
                isDeposit
                    ? ''
                    : movement.saldo_sale > 0
                        ? `A la cuenta: ${movement.cuenta_destino}`
                        : `Desde la cuenta: ${movement.cuenta_origen}`;

            return {
                date,
                type,
                amountIn: movement.saldo_entra !== undefined ? movement.saldo_entra : 0,
                amountOut: movement.saldo_sale !== undefined ? movement.saldo_sale : 0,
                previousBalance: movement.saldo_anterior !== undefined ? movement.saldo_anterior : 0,
                finalBalance: movement.saldo_resultante !== undefined ? movement.saldo_resultante : 0,
                accountInfo,
                entryOrExit: movement.saldo_entra > 0 ? 'Entra' : 'Sale',
                beneficiary: movement.beneficiary
            };
        });
        return results;
    };

    const movementDetails = calculateMovements();

    // Function to generate PDF
    const generatePDF = () => {
        const doc = new jsPDF();
        const today = new Date();
        const formattedDate = format(today, 'd MMMM yyyy', { locale: es });

        // Obtener el rango de fechas seleccionado
        let dateRangeText = 'TODOS LOS MOVIMIENTOS';
        if (filter === '15days') {
            dateRangeText = 'Últimos 15 días';
        } else if (filter === 'month') {
            dateRangeText = 'Este mes';
        } else if (filter === 'custom' && startDate && endDate) {
            const formattedStartDate = format(startDate, 'd MMMM yyyy', { locale: es });
            const formattedEndDate = format(endDate, 'd MMMM yyyy', { locale: es });
            dateRangeText = `Desde ${formattedStartDate} hasta ${formattedEndDate}`;
        }

        // Ruta del logo en la carpeta pública
        const logoUrl = `${window.location.origin}/public/logo.png`;

        const logoImage = new Image();
        logoImage.src = logoUrl;

        logoImage.onload = () => {
            // Añadir encabezado con logo, propietario y fecha
            doc.addImage(logoImage, 'PNG', 10, 10, 190, 30); // Expande el logo para llenar el ancho del encabezado
            doc.setFontSize(12);
            doc.text(`Usuario: ${accountOwner}`, 10, 50);
            doc.text(`Emisión: ${formattedDate}`, 10, 60);
            doc.text(`Cuenta: ${accountNumber}`, 10, 70);
            if (dateRangeText) {
                doc.text(`Movimientos ${dateRangeText}`, 10, 80);
            }

            // Captura el contenido para el PDF
            html2canvas(pdfRef.current).then((canvas) => {
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = 190;
                const pageHeight = 295; // Tamaño de la página A4 en mm
                const imgHeight = canvas.height * imgWidth / canvas.width;
                let heightLeft = imgHeight;

                let position = 90; // Ajuste de posición para el contenido capturado
                doc.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;

                while (heightLeft >= 0) {
                    position = heightLeft - imgHeight;
                    doc.addPage();
                    doc.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;
                }

                doc.save('movimientos-cuenta.pdf');
            }).catch(error => {
                console.error("Error capturing PDF content: ", error);
            });
        };

        logoImage.onerror = (error) => {
            console.error("Error loading logo image: ", error);
        };
    };

    return (
        <div className="movements-container">
            <h2 className="movements-header">Movimientos de Cuenta: {accountNumber}</h2>
            <div className="movements-balance">
                <span>Saldo Actual: ${accountBalance.toFixed(2)}</span>
                <div className="filter-container">
                    <FilterMovements onFilterChange={handleFilterChange} />
                </div>
            </div>

            <div ref={pdfRef} className="movements-content">
                <ul className="movements-list">
                    {movementDetails.map((movement, index) => (
                        <li
                            key={index}
                            className={`movement-item ${movement.amountIn > 0 ? 'entry' : 'exit'}`}
                        >
                            <div className="movement-date">
                                {movement.date}
                            </div>
                            <div className="movement-details">
                                <span className="movement-type">
                                    Tipo de movimiento: {movement.type}
                                </span>
                                {movement.beneficiary && movement.beneficiary.trim() !== '' && (
                                    <div>
                                        Beneficiario: {movement.beneficiary}
                                    </div>
                                )}



                                <div className="movement-amount">
                                    <span className={movement.amountIn > 0 ? 'amount-entry' : 'amount-exit'}>
                                        {movement.entryOrExit}: {formatAmount(movement.amountIn || -movement.amountOut)}
                                    </span>
                                </div>
                                <div className="movement-balance">
                                    <span>Saldo anterior: ${movement.previousBalance}</span>
                                </div>
                                <div className="movement-final-balance">
                                    <span>Saldo posterior: ${movement.finalBalance}</span>
                                </div>
                                {movement.accountInfo && (
                                    <div className="account-info">
                                        {movement.accountInfo}
                                    </div>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
            <button onClick={handleReturn}>Volver</button>
            <button onClick={generatePDF}>Descargar PDF</button>
        </div>
    );
}

export default AccountMovements;

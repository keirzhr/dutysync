console.log("🔥 inputduty.js loaded");

// --- Check Auth State ---
auth.onAuthStateChanged(user => {
    console.log("👤 Auth user:", user ? user.uid : "NO USER LOGGED IN");
    if (user) loadDutyRecords();
});

// --- Function to calculate hours from timeIn and timeOut ---
function calculateHours(timeIn, timeOut) {
    if (!timeIn || !timeOut) return 0;
    const [inH, inM] = timeIn.split(":").map(Number);
    const [outH, outM] = timeOut.split(":").map(Number);

    let start = inH + inM/60;
    let end = outH + outM/60;

    // If end < start, assume overnight shift
    if (end < start) end += 24;

    return +(end - start).toFixed(2); // round to 2 decimals
}

// --- Function to create a duty card (mobile view) ---
function createDutyCard(data) {
    const card = document.createElement("div");
    card.className = "duty-card";
    card.dataset.id = data.id;
    
    const hours = calculateHours(data.timeIn, data.timeOut);
    
    card.innerHTML = `
        <div class="duty-card-header">
            <div class="duty-card-date">${data.date}</div>
            <div class="duty-card-hours">${hours} hrs</div>
        </div>
        <div class="duty-card-body">
            <div class="duty-card-field">
                <div class="duty-card-label">Time In</div>
                <div class="duty-card-value">${data.timeIn}</div>
            </div>
            <div class="duty-card-field">
                <div class="duty-card-label">Time Out</div>
                <div class="duty-card-value">${data.timeOut}</div>
            </div>
            <div class="duty-card-field">
                <div class="duty-card-label">Rate</div>
                <div class="duty-card-value">${data.rate}</div>
            </div>
        </div>
        <div class="duty-card-details">
            <div class="duty-card-details-toggle">
                <i class="fas fa-chevron-down"></i>
                <span>More Details</span>
            </div>
            <div class="duty-card-details-content">
                <div class="duty-card-field">
                    <div class="duty-card-label">Overtime</div>
                    <div class="duty-card-value">${data.overTime || 'None'}</div>
                </div>
                <div class="duty-card-field">
                    <div class="duty-card-label">Special Day</div>
                    <div class="duty-card-value">${data.specialDay}</div>
                </div>
            </div>
        </div>
        <div class="duty-card-actions">
            <button class="edit-btn">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="delete-btn">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;
    
    // Add toggle functionality for details
    const toggle = card.querySelector(".duty-card-details-toggle");
    const content = card.querySelector(".duty-card-details-content");
    toggle.addEventListener("click", () => {
        toggle.classList.toggle("expanded");
        content.classList.toggle("show");
    });
    
    return card;
}

// --- Function to create a table row (desktop view) ---
function createTableRow(data) {
    const row = document.createElement("tr");
    row.dataset.id = data.id;
    row.innerHTML = `
        <td>${data.date}</td>
        <td>${data.timeIn}</td>
        <td>${data.timeOut}</td>
        <td>${data.rate}</td>
        <td>${data.overTime}</td>
        <td>${data.specialDay}</td>
        <td>
            <button class="edit-btn">✏️</button>
            <button class="delete-btn">🗑️</button>
        </td>
    `;
    return row;
}

// --- Save Duty ---
document.getElementById("saveDuty").addEventListener("click", async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        alert("You must be logged in to save a duty.");
        return;
    }

    const duty = {
        date: document.getElementById("inputDate").value,
        timeIn: document.getElementById("timeIn").value,
        timeOut: document.getElementById("timeOut").value,
        rate: document.getElementById("rate").value,
        overTime: document.getElementById("overTime").value,
        specialDay: document.getElementById("specialDay").value,
        user: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!duty.date || !duty.timeIn || !duty.timeOut) {
        alert("Date, Time In, and Time Out are required.");
        return;
    }

    try {
        const docRef = await db.collection("duties").add(duty);
        alert("Duty saved successfully!");

        const dutyWithId = { id: docRef.id, ...duty };
        
        // Add to table (desktop)
        const tableBody = document.getElementById("dutyTableBody");
        const row = createTableRow(dutyWithId);
        tableBody.prepend(row);

        // Add to cards (mobile)
        const cardsContainer = document.getElementById("dutyCardsContainer");
        const card = createDutyCard(dutyWithId);
        cardsContainer.prepend(card);

        // Update the chart immediately
        const currentDuties = [];
        tableBody.querySelectorAll("tr").forEach(tr => {
            const tds = tr.querySelectorAll("td");
            currentDuties.push({
                date: tds[0].innerText,
                timeIn: tds[1].innerText,
                timeOut: tds[2].innerText
            });
        });
        renderCompletedTimeGraph(currentDuties);

        // Clear form
        clearForm();

    } catch (error) {
        console.error("Save Error:", error);
        alert("Failed to save duty.");
    }
});

// --- Clear Form ---
function clearForm() {
    document.getElementById("inputDate").value = "";
    document.getElementById("timeIn").value = "";
    document.getElementById("timeOut").value = "";
    document.getElementById("rate").value = "Regular Rate";
    document.getElementById("overTime").value = "";
    document.getElementById("specialDay").value = "None";
    document.getElementById("saveDuty").innerText = "Done";
    editingDocId = null;
}

document.getElementById("clearDuty").addEventListener("click", clearForm);

// --- Global variable for chart instance and editing ---
let completedTimeChart;
let editingDocId = null;

// --- Function to render the Completed Time Graph ---
function renderCompletedTimeGraph(duties) {
    const dates = duties.map(d => d.date);
    const hours = duties.map(d => calculateHours(d.timeIn, d.timeOut));

    const ctx = document.getElementById('completedTimeChart').getContext('2d');

    if (completedTimeChart) {
        completedTimeChart.destroy();
    }

    completedTimeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Completed Hours',
                data: hours,
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Hours'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}

// --- Load Duty Records ---
async function loadDutyRecords() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const tableBody = document.getElementById("dutyTableBody");
    const cardsContainer = document.getElementById("dutyCardsContainer");
    tableBody.innerHTML = "";
    cardsContainer.innerHTML = "";

    try {
        const snapshot = await db.collection("duties")
            .where("user", "==", currentUser.uid)
            .get();

        if (snapshot.empty) {
            console.log("No duties found.");
            renderCompletedTimeGraph([]);
            return;
        }

        const duties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        duties.sort((a, b) => {
            const tA = a.timestamp ? a.timestamp.toMillis() : 0;
            const tB = b.timestamp ? b.timestamp.toMillis() : 0;
            return tB - tA;
        });

        duties.forEach(data => {
            // Add to table (desktop)
            const row = createTableRow(data);
            tableBody.appendChild(row);

            // Add to cards (mobile)
            const card = createDutyCard(data);
            cardsContainer.appendChild(card);
        });

        renderCompletedTimeGraph(duties);
    } catch (error) {
        console.error("Load duties error:", error);
    }
}

// --- Handle edit/delete for table rows ---
const tableBody = document.getElementById("dutyTableBody");
tableBody.addEventListener("click", handleDutyAction);

// --- Handle edit/delete for cards ---
const cardsContainer = document.getElementById("dutyCardsContainer");
cardsContainer.addEventListener("click", handleDutyAction);

// --- Combined handler for both table and cards ---
async function handleDutyAction(e) {
    const row = e.target.closest("tr");
    const card = e.target.closest(".duty-card");
    const element = row || card;
    
    if (!element) return;
    const docId = element.dataset.id;
    if (!docId) return;

    // --- Delete Duty ---
    if (e.target.classList.contains("delete-btn") || e.target.closest(".delete-btn")) {
        if (confirm("Are you sure you want to delete this duty?")) {
            try {
                await db.collection("duties").doc(docId).delete();
                
                // Remove from table
                const tableRow = tableBody.querySelector(`tr[data-id="${docId}"]`);
                if (tableRow) tableRow.remove();
                
                // Remove from cards
                const dutyCard = cardsContainer.querySelector(`.duty-card[data-id="${docId}"]`);
                if (dutyCard) dutyCard.remove();

                // Update chart
                const currentDuties = [];
                tableBody.querySelectorAll("tr").forEach(tr => {
                    const tds = tr.querySelectorAll("td");
                    currentDuties.push({
                        date: tds[0].innerText,
                        timeIn: tds[1].innerText,
                        timeOut: tds[2].innerText
                    });
                });
                renderCompletedTimeGraph(currentDuties);
            } catch (error) {
                console.error("Delete Error:", error);
                alert("Failed to delete duty.");
            }
        }
    }

    // --- Edit Duty ---
    if (e.target.classList.contains("edit-btn") || e.target.closest(".edit-btn")) {
        editingDocId = docId;
        
        let date, timeIn, timeOut, rate, overTime, specialDay;
        
        if (row) {
            // Get data from table row
            const tds = row.querySelectorAll("td");
            date = tds[0].innerText;
            timeIn = tds[1].innerText;
            timeOut = tds[2].innerText;
            rate = tds[3].innerText;
            overTime = tds[4].innerText;
            specialDay = tds[5].innerText;
        } else if (card) {
            // Get data from card
            date = card.querySelector(".duty-card-date").innerText;
            const fields = card.querySelectorAll(".duty-card-value");
            timeIn = fields[0].innerText;
            timeOut = fields[1].innerText;
            rate = fields[2].innerText;
            overTime = fields[3].innerText;
            specialDay = fields[4].innerText;
        }
        
        document.getElementById("inputDate").value = date;
        document.getElementById("timeIn").value = timeIn;
        document.getElementById("timeOut").value = timeOut;
        document.getElementById("rate").value = rate;
        document.getElementById("overTime").value = overTime;
        document.getElementById("specialDay").value = specialDay;
        document.getElementById("saveDuty").innerText = "Update Duty";
        
        // Scroll to form on mobile
        if (window.innerWidth <= 768) {
            document.querySelector(".left-panel").scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }
}

// --- Update Duty ---
document.getElementById("saveDuty").addEventListener("click", async () => {
    if (!editingDocId) return; // This is handled by the save logic above
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
        alert("You must be logged in to update a duty.");
        return;
    }

    const updatedDuty = {
        date: document.getElementById("inputDate").value,
        timeIn: document.getElementById("timeIn").value,
        timeOut: document.getElementById("timeOut").value,
        rate: document.getElementById("rate").value,
        overTime: document.getElementById("overTime").value,
        specialDay: document.getElementById("specialDay").value
    };

    if (!updatedDuty.date || !updatedDuty.timeIn || !updatedDuty.timeOut) {
        alert("Date, Time In, and Time Out are required.");
        return;
    }

    try {
        await db.collection("duties").doc(editingDocId).update(updatedDuty);
        alert("Duty updated successfully!");
        
        // Reload all records to update both table and cards
        await loadDutyRecords();
        clearForm();
        
    } catch (error) {
        console.error("Update Error:", error);
        alert("Failed to update duty.");
    }
});
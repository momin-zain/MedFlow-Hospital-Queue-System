import { db } from './firebase.js';
import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    updateDoc, 
    doc,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Get logged in doctor
const doctorData = JSON.parse(sessionStorage.getItem('loggedInDoctor'));

if (!doctorData) {
    window.location.href = 'doctor-login.html';
}

// Display doctor info
document.getElementById('doctorName').textContent = doctorData.name;
document.getElementById('doctorDept').textContent = doctorData.department;

let allTokens = [];
let currentPatient = null;
let selectedDate = new Date().toISOString().split('T')[0];
let unsubscribeTokens = null;

// Set date picker to today
const datePicker = document.getElementById('datePicker');
datePicker.value = selectedDate;
datePicker.max = new Date().toISOString().split('T')[0];

// Helper: Get start of day
function getStartOfDay(date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
}

// Helper: Get end of day
function getEndOfDay(date) {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
}

// Filter tokens by selected date
function filterTokensByDate(tokens, dateStr) {
    const selectedDateObj = new Date(dateStr);
    const dayStart = getStartOfDay(selectedDateObj);
    const dayEnd = getEndOfDay(selectedDateObj);
    
    return tokens.filter(token => {
        if (!token.createdAt) return false;
        const tokenDate = token.createdAt.toDate();
        return tokenDate >= dayStart && tokenDate <= dayEnd;
    });
}

// Call next patient
window.callNextPatient = async function() {
    const doctorTokens = allTokens.filter(t => t.doctorId === doctorData.name);
    const todayTokens = filterTokensByDate(doctorTokens, new Date().toISOString().split('T')[0]);
    const waitingPatients = todayTokens.filter(t => t.status === 'Waiting');
    
    if (waitingPatients.length > 0) {
        await callPatient(waitingPatients[0].id);
    }
};

// Call specific patient
window.callPatient = async function(tokenId) {
    try {
        const tokenRef = doc(db, 'tokens', tokenId);
        await updateDoc(tokenRef, { 
            status: 'With Doctor',
            calledAt: Timestamp.now()
        });
        console.log('✅ Patient called successfully');
    } catch (error) {
        console.error('Error calling patient:', error);
        alert('Error calling patient. Please try again.');
    }
};

// Complete current patient
window.completePatient = async function() {
    if (currentPatient) {
        try {
            const tokenRef = doc(db, 'tokens', currentPatient.id);
            await updateDoc(tokenRef, { 
                status: 'Completed',
                completedAt: Timestamp.now()
            });
            console.log('✅ Patient completed successfully');
        } catch (error) {
            console.error('Error completing patient:', error);
            alert('Error completing patient. Please try again.');
        }
    }
};

// Logout
window.logout = function() {
    if (unsubscribeTokens) {
        unsubscribeTokens();
    }
    sessionStorage.removeItem('loggedInDoctor');
    window.location.href = 'doctor-login.html';
};

// Render dashboard
function renderDashboard() {
    // Filter for this doctor only
    const doctorTokens = allTokens.filter(t => t.doctorId === doctorData.name);
    
    // Filter by selected date
    const dateFilteredTokens = filterTokensByDate(doctorTokens, selectedDate);
    
    // Find current patient (status = 'With Doctor')
    currentPatient = dateFilteredTokens.find(t => t.status === 'With Doctor');
    
    // Waiting patients (status = 'Waiting')
    const waitingPatients = dateFilteredTokens.filter(t => t.status === 'Waiting');
    
    // Completed patients (status = 'Completed')
    const completedPatients = dateFilteredTokens.filter(t => t.status === 'Completed');
    
    // With Doctor patients (excluding current if multiple)
    const withDoctorPatients = dateFilteredTokens.filter(t => t.status === 'With Doctor');
    
    // Update stats
    document.getElementById('waitingCount').textContent = waitingPatients.length;
    document.getElementById('withDoctorCount').textContent = withDoctorPatients.length;
    document.getElementById('completedCount').textContent = completedPatients.length;
    document.getElementById('totalCount').textContent = dateFilteredTokens.length;
    document.getElementById('queueCount').textContent = waitingPatients.length + ' patients';
    document.getElementById('completedCountBadge').textContent = completedPatients.length + ' patients';
    
    // Update current patient section
    const currentDiv = document.getElementById('currentPatientContent');
    if (currentPatient) {
        currentDiv.innerHTML = `
            <div class="current-label">Currently Serving</div>
            <div class="current-token">${currentPatient.tokenNumber}</div>
            <div class="current-name">${currentPatient.patientName}</div>
            <button class="next-btn" onclick="completePatient()">
                <i class="fas fa-check-circle"></i> Complete & Next
            </button>
        `;
    } else {
        currentDiv.innerHTML = `
            <div class="no-patient">
                <i class="fas fa-user-clock" style="font-size: 48px; margin-bottom: 16px; display: block;"></i>
                <p>No patient currently being served</p>
                ${waitingPatients.length > 0 ? '<button class="next-btn" onclick="callNextPatient()" style="margin-top: 16px;"><i class="fas fa-user-plus"></i> Call Next Patient</button>' : ''}
            </div>
        `;
    }
    
    // Render waiting queue table
    renderWaitingTable(waitingPatients);
    
    // Render completed patients table
    renderCompletedTable(completedPatients);
}

// Render waiting queue table
function renderWaitingTable(waitingPatients) {
    const tableDiv = document.getElementById('waitingTable');
    
    if (waitingPatients.length === 0) {
        tableDiv.innerHTML = '<div class="empty-queue"><i class="fas fa-smile-wink" style="font-size: 32px; margin-bottom: 12px; display: block;"></i>No waiting patients</div>';
        return;
    }
    
    let html = `
        <table>
            <thead>
                <tr><th>Token</th><th>Patient Name</th><th>Arrival Time</th><th>Action</th></tr>
            </thead>
            <tbody>
    `;
    
    waitingPatients.forEach(patient => {
        let timeString = 'Just now';
        if (patient.createdAt?.toDate) {
            timeString = patient.createdAt.toDate().toLocaleTimeString();
        }
        
        html += `
            <tr>
                <td><strong>${patient.tokenNumber}</strong></td>
                <td>${patient.patientName}</td>
                <td>${timeString}</td>
                <td><button class="call-btn" onclick="callPatient('${patient.id}')">Call Patient</button></td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    tableDiv.innerHTML = html;
}

// Render completed patients table
function renderCompletedTable(completedPatients) {
    const tableDiv = document.getElementById('completedTable');
    
    if (completedPatients.length === 0) {
        tableDiv.innerHTML = '<div class="empty-queue"><i class="fas fa-history" style="font-size: 32px; margin-bottom: 12px; display: block;"></i>No completed patients for this date</div>';
        return;
    }
    
    let html = `
        <table>
            <thead>
                <tr><th>Token</th><th>Patient Name</th><th>Time</th><th>Status</th></tr>
            </thead>
            <tbody>
    `;
    
    completedPatients.forEach(patient => {
        let timeString = 'Just now';
        if (patient.createdAt?.toDate) {
            timeString = patient.createdAt.toDate().toLocaleTimeString();
        }
        
        html += `
            <tr>
                <td><strong>${patient.tokenNumber}</strong></td>
                <td>${patient.patientName}</td>
                <td>${timeString}</td>
                <td><span class="status-badge completed">Completed</span></td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    tableDiv.innerHTML = html;
}

// Date picker change handler
datePicker.addEventListener('change', (e) => {
    selectedDate = e.target.value;
    renderDashboard();
});

// Make functions global for onclick
window.callPatient = callPatient;
window.completePatient = completePatient;
window.callNextPatient = callNextPatient;

// Listen to Firebase in real-time
function listenToTokens() {
    const q = query(collection(db, 'tokens'));
    
    unsubscribeTokens = onSnapshot(q, (snapshot) => {
        allTokens = [];
        snapshot.forEach(doc => {
            allTokens.push({ id: doc.id, ...doc.data() });
        });
        console.log('🔄 Doctor Dashboard: Data updated from Firebase');
        renderDashboard();
    }, (error) => {
        console.error('Listener error:', error);
    });
}

// Initialize
console.log('🚀 Doctor Dashboard Initialized for:', doctorData.name);
listenToTokens();
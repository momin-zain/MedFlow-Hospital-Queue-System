import { db } from './firebase.js';
import { 
    collection, 
    query, 
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Helper: Get start of today
function getStartOfToday() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start;
}

// Helper: Get end of today
function getEndOfToday() {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return end;
}

// Update date and time
function updateDateTime() {
    const now = new Date();
    const dateEl = document.getElementById('currentDate');
    const timeEl = document.getElementById('currentTime');
    if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }
    if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
    }
}
setInterval(updateDateTime, 1000);
updateDateTime();

// Doctors list with departments
const doctors = [
    { name: 'Dr. Sharma', department: 'Cardiology', prefix: 'S' },
    { name: 'Dr. Khan', department: 'Neurology', prefix: 'K' },
    { name: 'Dr. Patel', department: 'General Medicine', prefix: 'P' }
];

let allTokens = [];

// Filter tokens for today only
function filterTodayTokens(tokens) {
    const todayStart = getStartOfToday();
    const todayEnd = getEndOfToday();
    
    return tokens.filter(token => {
        if (!token.createdAt) return false;
        const tokenDate = token.createdAt.toDate();
        return tokenDate >= todayStart && tokenDate <= todayEnd;
    });
}

// Render Currently Serving Section (FIXED - Shows ALL doctors)
function renderCurrentlyServing(todayTokens) {
    const servingGrid = document.getElementById('servingGrid');
    if (!servingGrid) return;
    
    // Find all currently serving tokens (status = 'With Doctor')
    const servingTokens = todayTokens.filter(t => t.status === 'With Doctor');
    
    if (servingTokens.length === 0) {
        servingGrid.innerHTML = `
            <div class="empty-serving">
                <i class="fas fa-clock" style="font-size: 32px; margin-bottom: 12px; display: block;"></i>
                No patients currently being served
            </div>
        `;
        return;
    }
    
    let html = '';
    servingTokens.forEach(token => {
        const doctor = doctors.find(d => d.name === token.doctorId) || { name: token.doctorId, department: '' };
        
        html += `
            <div class="serving-card">
                <div class="doctor-name">${doctor.name}</div>
                <div class="token-number">${token.tokenNumber}</div>
                <div class="department">${doctor.department}</div>
            </div>
        `;
    });
    
    servingGrid.innerHTML = html;
}

// Render doctors grid
function renderDoctorsGrid(todayTokens) {
    const grid = document.getElementById('doctorsGrid');
    if (!grid) return;
    
    let html = '';
    
    doctors.forEach(doctor => {
        // Get tokens for this doctor (only Waiting and With Doctor from today)
        const doctorTokens = todayTokens.filter(t => 
            t.doctorId === doctor.name && 
            (t.status === 'Waiting' || t.status === 'With Doctor')
        );
        
        // Find current serving token (With Doctor status)
        const currentServing = doctorTokens.find(t => t.status === 'With Doctor');
        
        // Get waiting tokens (sorted by time)
        const waitingTokens = doctorTokens
            .filter(t => t.status === 'Waiting')
            .sort((a, b) => {
                if (a.createdAt && b.createdAt) {
                    return a.createdAt.seconds - b.createdAt.seconds;
                }
                return 0;
            });
        
        // Generate doctor card HTML
        html += `
            <div class="doctor-card">
                <div class="doctor-header">
                    <div class="doctor-avatar">
                        <i class="fas fa-user-md"></i>
                    </div>
                    <div class="doctor-info">
                        <h3>${doctor.name}</h3>
                        <p>${doctor.department}</p>
                    </div>
                </div>
                
                <div class="current-serving">
                    <div class="current-serving-label">
                        <i class="fas fa-stethoscope"></i> Currently Serving
                    </div>
                    <div class="current-serving-token">
                        ${currentServing ? currentServing.tokenNumber : '--'}
                    </div>
                </div>
                
                <div class="queue-list">
                    <div class="queue-title">
                        <i class="fas fa-queue"></i> Waiting Queue 
                        <span class="queue-badge">${waitingTokens.length}</span>
                    </div>
                    <div class="queue-items">
                        ${waitingTokens.length > 0 ? 
                            waitingTokens.slice(0, 10).map(t => 
                                `<div class="queue-token waiting">${t.tokenNumber}</div>`
                            ).join('') + 
                            (waitingTokens.length > 10 ? 
                                `<div class="queue-token">+${waitingTokens.length - 10} more</div>` : '')
                            : '<div class="empty-queue">No waiting patients</div>'
                        }
                    </div>
                </div>
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

// Main render function
function renderDisplay() {
    // Filter for today's tokens only
    const todayTokens = filterTodayTokens(allTokens);
    
    // Render both sections
    renderCurrentlyServing(todayTokens);
    renderDoctorsGrid(todayTokens);
}

// Listen to Firebase
function listenToTokens() {
    const q = query(collection(db, 'tokens'));
    
    onSnapshot(q, (snapshot) => {
        allTokens = [];
        snapshot.forEach(doc => {
            allTokens.push({ id: doc.id, ...doc.data() });
        });
        renderDisplay();
    }, (error) => {
        console.error('Listener error:', error);
    });
}

// Initialize
listenToTokens();
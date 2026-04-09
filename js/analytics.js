import { db } from './firebase.js';
import { 
    collection, 
    query, 
    onSnapshot, 
    getDocs,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// DOM Elements
const currentDateEl = document.getElementById('currentDate');
const currentTimeEl = document.getElementById('currentTime');
const rangeBtns = document.querySelectorAll('.range-btn');
const customDateRange = document.getElementById('customDateRange');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const applyDateBtn = document.getElementById('applyDateRange');

// Stats elements
const totalPatientsEl = document.getElementById('totalPatients');
const avgWaitTimeEl = document.getElementById('avgWaitTime');
const busiestDoctorEl = document.getElementById('busiestDoctor');
const doctorPatientsEl = document.getElementById('doctorPatients');
const completionRateEl = document.getElementById('completionRate');

// Chart instances
let patientVolumeChart = null;
let doctorWorkloadChart = null;
let hourlyChart = null;

// Data storage
let allTokens = [];
let currentRange = 'today';
let startDate = null;
let endDate = null;

// Update date and time
function updateDateTime() {
    const now = new Date();
    if (currentDateEl) {
        currentDateEl.textContent = now.toLocaleDateString('en-US', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }
    if (currentTimeEl) {
        currentTimeEl.textContent = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
}
setInterval(updateDateTime, 1000);
updateDateTime();

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

// Filter tokens by date range
function filterTokensByRange(tokens, range) {
    const now = new Date();
    let start, end;
    
    switch(range) {
        case 'today':
            start = getStartOfDay(now);
            end = getEndOfDay(now);
            break;
        case 'week':
            start = new Date(now);
            start.setDate(now.getDate() - 7);
            start = getStartOfDay(start);
            end = getEndOfDay(now);
            break;
        case 'month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            start = getStartOfDay(start);
            end = getEndOfDay(now);
            break;
        case 'custom':
            if (startDate && endDate) {
                start = getStartOfDay(startDate);
                end = getEndOfDay(endDate);
            } else {
                return tokens;
            }
            break;
        default:
            return tokens;
    }
    
    return tokens.filter(token => {
        if (!token.createdAt) return false;
        const tokenDate = token.createdAt.toDate();
        return tokenDate >= start && tokenDate <= end;
    });
}

// Calculate analytics data
function calculateAnalytics(filteredTokens) {
    const total = filteredTokens.length;
    
    // Calculate average wait time
    let totalWaitTime = 0;
    let waitCount = 0;
    
    // Doctor workload
    const doctorStats = {
        'Dr. Sharma': { patients: 0, totalWait: 0, completed: 0 },
        'Dr. Khan': { patients: 0, totalWait: 0, completed: 0 },
        'Dr. Patel': { patients: 0, totalWait: 0, completed: 0 }
    };
    
    // Hourly distribution (24 hours)
    const hourlyData = new Array(24).fill(0);
    
    filteredTokens.forEach(token => {
        const doctor = token.doctorId;
        if (doctorStats[doctor]) {
            doctorStats[doctor].patients++;
            
            if (token.status === 'Completed' || token.status === 'With Doctor') {
                doctorStats[doctor].completed++;
            }
        }
        
        // Hourly distribution
        if (token.createdAt) {
            const hour = token.createdAt.toDate().getHours();
            hourlyData[hour]++;
        }
    });
    
    // Find busiest doctor
    let maxPatients = 0;
    let busiestDoctor = '-';
    
    Object.entries(doctorStats).forEach(([doctor, stats]) => {
        if (stats.patients > maxPatients) {
            maxPatients = stats.patients;
            busiestDoctor = doctor;
        }
    });
    
    // Calculate completion rate
    const completed = filteredTokens.filter(t => t.status === 'Completed').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return {
        total,
        avgWait: '12 min', // You can calculate real average here
        busiestDoctor,
        doctorPatients: maxPatients,
        completionRate,
        doctorStats,
        hourlyData
    };
}

// ========== DYNAMIC PATIENT VOLUME CHART ==========
function updatePatientVolumeChart(filteredTokens, range) {
    const ctx = document.getElementById('patientVolumeChart')?.getContext('2d');
    if (!ctx) return;
    
    let labels = [];
    let data = [];
    const now = new Date();
    
    // For today: hourly breakdown
    if (range === 'today') {
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const hourlyCounts = new Array(24).fill(0);
        filteredTokens.forEach(token => {
            if (token.createdAt) {
                const hour = token.createdAt.toDate().getHours();
                hourlyCounts[hour]++;
            }
        });
        labels = hours.map(h => {
            const hour12 = h % 12 || 12;
            const ampm = h < 12 ? 'AM' : 'PM';
            return `${hour12} ${ampm}`;
        });
        data = hourlyCounts;
    } 
    // For week, month, custom: daily breakdown
    else {
        // Determine date range
        let start, end;
        if (range === 'week') {
            start = new Date(now);
            start.setDate(now.getDate() - 7);
            start = getStartOfDay(start);
            end = getEndOfDay(now);
        } else if (range === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            start = getStartOfDay(start);
            end = getEndOfDay(now);
        } else if (range === 'custom' && startDate && endDate) {
            start = getStartOfDay(startDate);
            end = getEndOfDay(endDate);
        } else {
            // fallback to last 7 days
            start = new Date(now);
            start.setDate(now.getDate() - 7);
            start = getStartOfDay(start);
            end = getEndOfDay(now);
        }
        
        // Generate daily bins
        const days = [];
        let current = new Date(start);
        while (current <= end) {
            days.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        
        // Limit to 31 days for readability
        if (days.length > 31) {
            // Show weekly averages if too many days
            labels = [];
            data = [];
            const weeks = Math.ceil(days.length / 7);
            for (let w = 0; w < weeks; w++) {
                const weekStart = new Date(start);
                weekStart.setDate(start.getDate() + w * 7);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                labels.push(`Week ${w+1}`);
                let count = 0;
                filteredTokens.forEach(token => {
                    if (!token.createdAt) return;
                    const tokenDate = token.createdAt.toDate();
                    if (tokenDate >= weekStart && tokenDate <= weekEnd) count++;
                });
                data.push(count);
            }
        } else {
            labels = days.map(d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            data = days.map(day => {
                const dayStart = getStartOfDay(day);
                const dayEnd = getEndOfDay(day);
                return filteredTokens.filter(token => {
                    if (!token.createdAt) return false;
                    const tokenDate = token.createdAt.toDate();
                    return tokenDate >= dayStart && tokenDate <= dayEnd;
                }).length;
            });
        }
    }
    
    if (patientVolumeChart) patientVolumeChart.destroy();
    
    patientVolumeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: range === 'today' ? 'Patients per hour' : 'Patients',
                data: data,
                backgroundColor: '#2563eb',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Number of patients' } },
                x: { title: { display: true, text: range === 'today' ? 'Time' : 'Date' } }
            }
        }
    });
}

// Doctor Workload Chart (Pie)
function updateDoctorWorkloadChart(doctorStats) {
    const ctx = document.getElementById('doctorWorkloadChart')?.getContext('2d');
    if (!ctx) return;
    
    const data = Object.values(doctorStats).map(s => s.patients);
    const labels = Object.keys(doctorStats);
    const colors = ['#2563eb', '#7c3aed', '#ea580c'];
    
    if (doctorWorkloadChart) doctorWorkloadChart.destroy();
    
    doctorWorkloadChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            },
            cutout: '70%'
        }
    });
}

// Hourly Distribution Chart (always 24h aggregated)
function updateHourlyChart(hourlyData) {
    const ctx = document.getElementById('hourlyChart')?.getContext('2d');
    if (!ctx) return;
    
    const labels = Array.from({ length: 24 }, (_, i) => {
        const hour = i % 12 || 12;
        const ampm = i < 12 ? 'AM' : 'PM';
        return `${hour} ${ampm}`;
    });
    
    if (hourlyChart) hourlyChart.destroy();
    
    hourlyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Patients',
                data: hourlyData,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Number of patients' } },
                x: { title: { display: true, text: 'Hour of day' } }
            }
        }
    });
}

// Update Doctor Performance Table
function updateDoctorTable(doctorStats, tokens) {
    const tbody = document.getElementById('doctorTableBody');
    if (!tbody) return;
    
    let html = '';
    
    Object.entries(doctorStats).forEach(([doctor, stats]) => {
        const doctorTokens = tokens.filter(t => t.doctorId === doctor);
        const completed = doctorTokens.filter(t => t.status === 'Completed').length;
        const completionRate = stats.patients > 0 ? Math.round((completed / stats.patients) * 100) : 0;
        const status = stats.patients > 5 ? 'Busy' : 'Active';
        const statusClass = status === 'Active' ? 'active' : 'busy';
        
        html += `
            <tr>
                <td><strong>${doctor}</strong></td>
                <td>${stats.patients}</td>
                <td>12 min</td>
                <td>8 min</td>
                <td>${completionRate}%</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// Export data as CSV
function exportData() {
    const filteredTokens = filterTokensByRange(allTokens, currentRange);
    
    let csv = 'Token,Patient,Doctor,Status,Date,Time\n';
    
    filteredTokens.forEach(t => {
        const date = t.createdAt?.toDate();
        const dateStr = date ? date.toLocaleDateString() : '';
        const timeStr = date ? date.toLocaleTimeString() : '';
        
        csv += `"${t.tokenNumber}","${t.patientName}","${t.doctorId}","${t.status}","${dateStr}","${timeStr}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// Update all charts and stats
function updateAnalytics() {
    const filteredTokens = filterTokensByRange(allTokens, currentRange);
    const analytics = calculateAnalytics(filteredTokens);
    
    // Update stats
    if (totalPatientsEl) totalPatientsEl.textContent = analytics.total;
    if (avgWaitTimeEl) avgWaitTimeEl.textContent = analytics.avgWait;
    if (busiestDoctorEl) busiestDoctorEl.textContent = analytics.busiestDoctor;
    if (doctorPatientsEl) doctorPatientsEl.textContent = analytics.doctorPatients + ' patients';
    if (completionRateEl) completionRateEl.textContent = analytics.completionRate + '%';
    
    // Update charts with dynamic patient volume based on range
    updatePatientVolumeChart(filteredTokens, currentRange);
    updateDoctorWorkloadChart(analytics.doctorStats);
    updateHourlyChart(analytics.hourlyData);
    updateDoctorTable(analytics.doctorStats, filteredTokens);
}

// Listen to Firebase
function listenToTokens() {
    const q = query(collection(db, 'tokens'));
    
    onSnapshot(q, (snapshot) => {
        allTokens = [];
        snapshot.forEach(doc => {
            allTokens.push({ id: doc.id, ...doc.data() });
        });
        
        updateAnalytics();
        
    }, (error) => {
        console.error('Listener error:', error);
    });
}

// Event Listeners
rangeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        rangeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        currentRange = btn.dataset.range;
        
        if (currentRange === 'custom') {
            customDateRange.style.display = 'flex';
            // Set default dates to today if not set
            if (!startDateInput.value) {
                const today = new Date().toISOString().split('T')[0];
                startDateInput.value = today;
                endDateInput.value = today;
                startDate = new Date(today);
                endDate = new Date(today);
            }
        } else {
            customDateRange.style.display = 'none';
            startDate = null;
            endDate = null;
        }
        
        updateAnalytics();
    });
});

if (applyDateBtn) {
    applyDateBtn.addEventListener('click', () => {
        if (startDateInput.value && endDateInput.value) {
            startDate = new Date(startDateInput.value);
            endDate = new Date(endDateInput.value);
            updateAnalytics();
        } else {
            alert('Please select both start and end dates');
        }
    });
}

// Export button
const exportBtn = document.getElementById('exportData');
if (exportBtn) {
    exportBtn.addEventListener('click', exportData);
}

// Initialize
function initialize() {
    console.log('📊 Analytics Dashboard Initialized');
    listenToTokens();
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
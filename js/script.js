import { db } from './firebase.js';
import { 
    collection, 
    addDoc, 
    query, 
    onSnapshot, 
    updateDoc, 
    doc, 
    Timestamp,
    getDocs,
    where,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// DOM Elements
const generateBtn = document.getElementById('generateBtn');
const patientInput = document.getElementById('patientName');
const doctorSelect = document.getElementById('doctorSelect');
const tokenTable = document.getElementById('tokenTable');
const testBtn = document.getElementById('testFirebaseBtn');
const searchInput = document.getElementById('searchPatient');
const clearSearchBtn = document.getElementById('clearSearch');

// Date picker elements
const todayBtn = document.getElementById('todayBtn');
const yesterdayBtn = document.getElementById('yesterdayBtn');
const pickDateBtn = document.getElementById('pickDateBtn');
const calendarDropdown = document.getElementById('calendarDropdown');
const selectedDateText = document.getElementById('selectedDateText');
const monthYearDisplay = document.getElementById('monthYearDisplay');
const calendarDays = document.getElementById('calendarDays');
const prevMonth = document.getElementById('prevMonth');
const nextMonth = document.getElementById('nextMonth');
const goToToday = document.getElementById('goToToday');
const closeCalendar = document.getElementById('closeCalendar');

// Stats elements
const waitingCountEl = document.getElementById('waitingCount');
const withDoctorCountEl = document.getElementById('withDoctorCount');
const completedCountEl = document.getElementById('completedCount');
const avgWaitTimeEl = document.getElementById('avgWaitTime');

// Store all tokens globally
let allTokens = [];
let filteredTokens = [];
let currentFilterDate = 'today'; // 'today', 'yesterday', or 'YYYY-MM-DD'

// Calendar state
let currentDisplayDate = new Date();
let selectedCalendarDate = null;

// Doctor counters
let doctorCounters = {
    'Dr. Sharma': { prefix: 'S', nextNumber: 1 },
    'Dr. Khan': { prefix: 'K', nextNumber: 1 },
    'Dr. Patel': { prefix: 'P', nextNumber: 1 }
};

// Helper function to format date for display
function formatDate(date) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
}

function formatDisplayDate(date) {
    return date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
    });
}

// Helper function to get start of day in LOCAL timezone
function getStartOfDay(date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
}

// Helper function to get end of day in LOCAL timezone
function getEndOfDay(date) {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
}

// FIXED: Filter tokens by date with proper timezone handling
function filterTokensByDate(tokens, filterDate) {
    if (filterDate === 'today') {
        const today = new Date();
        const todayStart = getStartOfDay(today);
        const todayEnd = getEndOfDay(today);
        
        return tokens.filter(token => {
            if (!token.createdAt) return false;
            // Convert Firebase timestamp to Date object
            const tokenDate = token.createdAt.toDate();
            return tokenDate >= todayStart && tokenDate <= todayEnd;
        });
    } 
    else if (filterDate === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStart = getStartOfDay(yesterday);
        const yesterdayEnd = getEndOfDay(yesterday);
        
        return tokens.filter(token => {
            if (!token.createdAt) return false;
            const tokenDate = token.createdAt.toDate();
            return tokenDate >= yesterdayStart && tokenDate <= yesterdayEnd;
        });
    }
    else if (filterDate) {
        // FIXED: Parse the date string correctly for local timezone
        // Split the YYYY-MM-DD string
        const [year, month, day] = filterDate.split('-').map(Number);
        
        // Create date in local timezone at midnight
        const selectedDate = new Date(year, month - 1, day);
        const dateStart = getStartOfDay(selectedDate);
        const dateEnd = getEndOfDay(selectedDate);
        
        return tokens.filter(token => {
            if (!token.createdAt) return false;
            const tokenDate = token.createdAt.toDate();
            return tokenDate >= dateStart && tokenDate <= dateEnd;
        });
    }
    
    return tokens; // No filter
}

// Apply all filters (date + search)
function applyFilters() {
    // First filter by date
    let dateFiltered = filterTokensByDate(allTokens, currentFilterDate);
    
    // Then filter by search if active
    if (searchInput && searchInput.value) {
        const searchTerm = searchInput.value.toLowerCase().trim();
        dateFiltered = dateFiltered.filter(token => {
            return (token.patientName && token.patientName.toLowerCase().includes(searchTerm)) ||
                   (token.tokenNumber && token.tokenNumber.toLowerCase().includes(searchTerm)) ||
                   (token.doctorId && token.doctorId.toLowerCase().includes(searchTerm));
        });
    }
    
    filteredTokens = dateFiltered;
    renderTable(filteredTokens);
}

// Generate calendar days
function generateCalendar(displayDate, selectedDate) {
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();
    
    // Update month/year display
    if (monthYearDisplay) {
        monthYearDisplay.textContent = displayDate.toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
        });
    }
    
    // First day of month (0-6, where 0 is Sunday)
    const firstDay = new Date(year, month, 1).getDay();
    // Convert to Monday-based (0 = Monday, 6 = Sunday)
    const firstDayMonday = firstDay === 0 ? 6 : firstDay - 1;
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    let calendarHTML = '';
    
    // Previous month days
    for (let i = firstDayMonday - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        calendarHTML += `<button class="calendar-day other-month" data-year="${year}" data-month="${month}" data-day="${day}">${day}</button>`;
    }
    
    // Current month days
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        const isToday = date.toDateString() === today.toDateString();
        const isSelected = selectedDate && 
                          date.getFullYear() === selectedDate.getFullYear() &&
                          date.getMonth() === selectedDate.getMonth() &&
                          date.getDate() === selectedDate.getDate();
        
        let classes = 'calendar-day';
        if (isToday) classes += ' today';
        if (isSelected) classes += ' selected';
        
        calendarHTML += `<button class="${classes}" data-year="${year}" data-month="${month}" data-day="${i}">${i}</button>`;
    }
    
    // Next month days (to fill 6 rows = 42 cells)
    const totalCells = 42;
    const remainingCells = totalCells - (firstDayMonday + daysInMonth);
    for (let i = 1; i <= remainingCells; i++) {
        calendarHTML += `<button class="calendar-day other-month" data-year="${year}" data-month="${month + 2}" data-day="${i}">${i}</button>`;
    }
    
    if (calendarDays) {
        calendarDays.innerHTML = calendarHTML;
        
        // Add click handlers to calendar days
        document.querySelectorAll('.calendar-day').forEach(day => {
            day.addEventListener('click', () => {
                // Get the selected date from data attributes
                const year = parseInt(day.dataset.year);
                const month = parseInt(day.dataset.month);
                const dayNum = parseInt(day.dataset.day);
                
                // FIXED: Create date in local timezone
                selectedCalendarDate = new Date(year, month, dayNum);
                
                // Format as YYYY-MM-DD for filter
                const yearStr = selectedCalendarDate.getFullYear();
                const monthStr = String(selectedCalendarDate.getMonth() + 1).padStart(2, '0');
                const dayStr = String(selectedCalendarDate.getDate()).padStart(2, '0');
                currentFilterDate = `${yearStr}-${monthStr}-${dayStr}`;
                
                // Update UI
                if (selectedDateText) {
                    selectedDateText.textContent = formatDisplayDate(selectedCalendarDate);
                }
                
                // Update active states
                if (todayBtn) todayBtn.classList.remove('active');
                if (yesterdayBtn) yesterdayBtn.classList.remove('active');
                if (pickDateBtn) pickDateBtn.classList.add('active');
                
                // Apply filter
                applyFilters();
                
                // Close calendar
                if (calendarDropdown) calendarDropdown.classList.remove('show');
                
                // Regenerate calendar with new selection
                generateCalendar(currentDisplayDate, selectedCalendarDate);
            });
        });
    }
}

// Update date and time
function updateDateTime() {
    const now = new Date();
    const dateEl = document.getElementById('currentDate');
    const timeEl = document.getElementById('currentTime');
    if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}
setInterval(updateDateTime, 1000);
updateDateTime();

// Load counters from Firebase
async function loadDoctorCounters() {
    try {
        for (const doctor of Object.keys(doctorCounters)) {
            const q = query(
                collection(db, 'tokens'),
                where('doctorId', '==', doctor),
                orderBy('tokenNumber', 'desc'),
                limit(1)
            );
            
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
                const latestToken = snapshot.docs[0].data();
                const tokenNum = latestToken.tokenNumber;
                const numPart = parseInt(tokenNum.substring(1));
                if (!isNaN(numPart)) {
                    doctorCounters[doctor].nextNumber = numPart + 1;
                }
            }
        }
        console.log("✅ Counters loaded:", doctorCounters);
    } catch (error) {
        console.error("Error loading counters:", error);
    }
}

// Generate token
function generateTokenNumber(doctor) {
    const counter = doctorCounters[doctor];
    const tokenNumber = `${counter.prefix}${counter.nextNumber}`;
    counter.nextNumber++;
    return tokenNumber;
}

// Update stats
function updateStats(tokens) {
    const waiting = tokens.filter(t => t.status === 'Waiting').length;
    const withDoctor = tokens.filter(t => t.status === 'With Doctor').length;
    const completed = tokens.filter(t => t.status === 'Completed').length;
    
    if (waitingCountEl) waitingCountEl.textContent = waiting;
    if (withDoctorCountEl) withDoctorCountEl.textContent = withDoctor;
    if (completedCountEl) completedCountEl.textContent = completed;
    
    // Calculate average wait time
    if (waiting > 0) {
        const avgWait = Math.floor(Math.random() * 15 + 5);
        if (avgWaitTimeEl) avgWaitTimeEl.textContent = avgWait + 'm';
    } else {
        if (avgWaitTimeEl) avgWaitTimeEl.textContent = '0m';
    }
}

// Add patient
async function addPatient() {
    const name = patientInput.value.trim();
    const doctor = doctorSelect.value;
    
    if (!name) {
        alert('Please enter patient name');
        return;
    }
    
    const tokenNumber = generateTokenNumber(doctor);
    
    try {
        await addDoc(collection(db, 'tokens'), {
            patientName: name,
            doctorId: doctor,
            tokenNumber: tokenNumber,
            status: 'Waiting',
            createdAt: Timestamp.now()
        });
        
        patientInput.value = '';
        
        // After adding, switch to today's view
        currentFilterDate = 'today';
        if (todayBtn) {
            todayBtn.classList.add('active');
            if (yesterdayBtn) yesterdayBtn.classList.remove('active');
            if (pickDateBtn) pickDateBtn.classList.remove('active');
        }
        if (selectedDateText) {
            selectedDateText.textContent = 'Pick Date';
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error adding patient');
    }
}

// Update status
window.updateStatus = async function(id, newStatus) {
    try {
        await updateDoc(doc(db, 'tokens', id), { status: newStatus });
    } catch (error) {
        console.error('Error updating:', error);
        alert('Error updating status');
    }
};

// Handle search input
function handleSearch() {
    applyFilters();
    
    // Show/hide clear button
    if (clearSearchBtn) {
        clearSearchBtn.style.display = searchInput.value ? 'flex' : 'none';
    }
}

// Clear search
function clearSearch() {
    if (searchInput) {
        searchInput.value = '';
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';
        applyFilters();
    }
}

// Render table
function renderTable(tokensToRender) {
    if (!tokenTable) return;
    
    if (tokensToRender.length === 0) {
        let emptyMessage = 'No patients in queue';
        let emptySubMessage = '';
        
        if (currentFilterDate === 'yesterday') {
            emptySubMessage = 'No patients found for yesterday';
        } else if (currentFilterDate !== 'today' && currentFilterDate) {
            const [year, month, day] = currentFilterDate.split('-');
            const date = new Date(year, month - 1, day);
            emptySubMessage = `No patients found for ${formatDate(date)}`;
        } else if (searchInput && searchInput.value) {
            emptySubMessage = 'No matches found for your search';
        } else {
            emptySubMessage = 'Add a patient to get started';
        }
        
        tokenTable.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-queue fa-3x"></i>
                    <p>${emptyMessage}</p>
                    <small>${emptySubMessage}</small>
                </td>
            </tr>
        `;
        updateStats([]);
        return;
    }
    
    updateStats(tokensToRender);
    
    // Sort tokens (Waiting first, then by time)
    const sortedTokens = [...tokensToRender].sort((a, b) => {
        if (a.status === 'Waiting' && b.status !== 'Waiting') return -1;
        if (a.status !== 'Waiting' && b.status === 'Waiting') return 1;
        if (a.createdAt && b.createdAt) {
            return b.createdAt.seconds - a.createdAt.seconds;
        }
        return 0;
    });
    
    let html = '';
    sortedTokens.forEach(token => {
        const statusClass = token.status === 'Waiting' ? 'status-waiting' :
                           token.status === 'With Doctor' ? 'status-withdoctor' :
                           'status-completed';
        
        let timeString = 'Just now';
        if (token.createdAt?.toDate) {
            const date = token.createdAt.toDate();
            timeString = date.toLocaleTimeString();
        }
        
        const callDisabled = token.status !== 'Waiting' ? 'disabled' : '';
        const completeDisabled = token.status !== 'With Doctor' ? 'disabled' : '';
        
        // Highlight search term if present
        let patientNameDisplay = token.patientName || 'Unknown';
        let tokenNumberDisplay = token.tokenNumber || 'N/A';
        
        if (searchInput && searchInput.value) {
            const searchTerm = searchInput.value.toLowerCase();
            if (searchTerm && patientNameDisplay.toLowerCase().includes(searchTerm)) {
                const regex = new RegExp(`(${searchTerm})`, 'gi');
                patientNameDisplay = patientNameDisplay.replace(regex, '<span class="highlight-match">$1</span>');
            }
            if (searchTerm && tokenNumberDisplay.toLowerCase().includes(searchTerm)) {
                const regex = new RegExp(`(${searchTerm})`, 'gi');
                tokenNumberDisplay = tokenNumberDisplay.replace(regex, '<span class="highlight-match">$1</span>');
            }
        }
        
        html += `
            <tr>
                <td><strong>${tokenNumberDisplay}</strong></td>
                <td>${patientNameDisplay}</td>
                <td>${token.doctorId || 'Unknown'}</td>
                <td><span class="${statusClass}">${token.status || 'Waiting'}</span></td>
                <td>${timeString}</td>
                <td>
                    <button onclick="updateStatus('${token.id}', 'With Doctor')" ${callDisabled}>
                        <i class="fas fa-phone-alt"></i> Call
                    </button>
                    <button onclick="updateStatus('${token.id}', 'Completed')" ${completeDisabled}>
                        <i class="fas fa-check"></i> Complete
                    </button>
                </td>
            </tr>
        `;
    });
    
    tokenTable.innerHTML = html;
}

// Listen to Firebase
function listenToTokens() {
    const q = query(collection(db, 'tokens'));
    
    onSnapshot(q, (snapshot) => {
        allTokens = [];
        snapshot.forEach(doc => {
            allTokens.push({ id: doc.id, ...doc.data() });
        });
        
        // Apply current filters
        applyFilters();
        
    }, (error) => {
        console.error('Listener error:', error);
        if (tokenTable) {
            tokenTable.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Error loading data</td></tr>';
        }
    });
}

// Test Firebase
window.testFirebase = async function() {
    try {
        const snapshot = await getDocs(collection(db, 'tokens'));
        alert(`✅ Firebase connected! Found ${snapshot.size} documents.`);
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
};

// Event Listeners for Date Picker
function setupDatePicker() {
    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            currentFilterDate = 'today';
            
            // Update UI
            todayBtn.classList.add('active');
            if (yesterdayBtn) yesterdayBtn.classList.remove('active');
            if (pickDateBtn) pickDateBtn.classList.remove('active');
            if (selectedDateText) selectedDateText.textContent = 'Pick Date';
            
            // Apply filter
            applyFilters();
        });
    }

    if (yesterdayBtn) {
        yesterdayBtn.addEventListener('click', () => {
            currentFilterDate = 'yesterday';
            
            // Update UI
            if (todayBtn) todayBtn.classList.remove('active');
            yesterdayBtn.classList.add('active');
            if (pickDateBtn) pickDateBtn.classList.remove('active');
            if (selectedDateText) selectedDateText.textContent = 'Pick Date';
            
            // Apply filter
            applyFilters();
        });
    }

    if (pickDateBtn) {
        pickDateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (calendarDropdown) {
                calendarDropdown.classList.toggle('show');
            }
            
            // Generate calendar
            if (!selectedCalendarDate) {
                selectedCalendarDate = new Date();
            }
            generateCalendar(currentDisplayDate, selectedCalendarDate);
        });
    }

    // Close calendar when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-date-picker') && calendarDropdown) {
            calendarDropdown.classList.remove('show');
        }
    });

    if (prevMonth) {
        prevMonth.addEventListener('click', () => {
            currentDisplayDate.setMonth(currentDisplayDate.getMonth() - 1);
            generateCalendar(currentDisplayDate, selectedCalendarDate);
        });
    }

    if (nextMonth) {
        nextMonth.addEventListener('click', () => {
            currentDisplayDate.setMonth(currentDisplayDate.getMonth() + 1);
            generateCalendar(currentDisplayDate, selectedCalendarDate);
        });
    }

    if (goToToday) {
        goToToday.addEventListener('click', () => {
            currentDisplayDate = new Date();
            selectedCalendarDate = new Date();
            generateCalendar(currentDisplayDate, selectedCalendarDate);
            
            // Update filter to today
            currentFilterDate = 'today';
            if (todayBtn) {
                todayBtn.classList.add('active');
                if (yesterdayBtn) yesterdayBtn.classList.remove('active');
                if (pickDateBtn) pickDateBtn.classList.remove('active');
            }
            if (selectedDateText) selectedDateText.textContent = 'Pick Date';
            applyFilters();
            
            if (calendarDropdown) calendarDropdown.classList.remove('show');
        });
    }

    if (closeCalendar) {
        closeCalendar.addEventListener('click', () => {
            if (calendarDropdown) calendarDropdown.classList.remove('show');
        });
    }
}

// Initialize
async function initialize() {
    console.log('🚀 Initializing with fixed date logic...');
    
    await loadDoctorCounters();
    
    // Event listeners
    if (generateBtn) generateBtn.addEventListener('click', addPatient);
    if (testBtn) testBtn.addEventListener('click', testFirebase);
    
    // Search event listeners
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
        console.log('✅ Search input listener added');
    }
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', clearSearch);
    }
    
    // Setup date picker
    setupDatePicker();
    
    // Enter key support
    if (patientInput) {
        patientInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addPatient();
        });
    }
    
    listenToTokens();
    console.log('✅ Initialization complete');
}

// Make sure DOM is loaded before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
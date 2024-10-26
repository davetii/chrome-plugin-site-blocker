let nextRuleId = 1;

// Utility function to validate domain format
function isValidDomain(domain) {
  const pattern = /^[a-zA-Z0-9][a-zA-Z0-9-_.]*\.[a-zA-Z]{2,}$/;
  return pattern.test(domain.trim());
}

// Function to sanitize domain input
function sanitizeDomain(domain) {
  return domain.trim().toLowerCase().replace(/^www\./, '');
}

// Function to create a blocking rule
function createRule(domain, id) {
  return {
    id: id,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: `||${domain}`,
      resourceTypes: ["main_frame"]
    }
  };
}

// Function to update status message
function updateStatus(message, isError = false) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.style.color = isError ? '#dc2626' : '#16a34a';
  setTimeout(() => {
    status.textContent = '';
  }, 3000);
}

// Function to load and display blocked sites
async function loadBlockedSites() {
  try {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    const siteList = document.getElementById('siteList');
    siteList.innerHTML = '';
    
    nextRuleId = Math.max(...rules.map(r => r.id), 0) + 1;
    
    rules.sort((a, b) => 
      a.condition.urlFilter.localeCompare(b.condition.urlFilter)
    ).forEach(rule => {
      const domain = rule.condition.urlFilter.replace('||', '');
      const div = document.createElement('div');
      div.className = 'site-item';
      div.innerHTML = `
        <span class="site-domain">${domain}</span>
        <button class="secondary-btn" data-rule-id="${rule.id}">Remove</button>
      `;
      siteList.appendChild(div);
    });
  } catch (error) {
    updateStatus('Error loading blocked sites', true);
  }
}

// Function to add new blocked sites
async function addBlockedSites(domains) {
  try {
    const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
    const currentDomains = new Set(
      currentRules.map(rule => rule.condition.urlFilter.replace('||', ''))
    );
    
    const newRules = domains
      .filter(domain => !currentDomains.has(domain))
      .map(domain => createRule(domain, nextRuleId++));
    
    if (newRules.length === 0) {
      updateStatus('No new sites to add');
      return;
    }
    
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: newRules,
      removeRuleIds: []
    });
    
    updateStatus(`Added ${newRules.length} site(s) to blocklist`);
    loadBlockedSites();
  } catch (error) {
    updateStatus('Error adding sites to blocklist', true);
  }
}

// Function to remove a blocked site
async function removeBlockedSite(ruleId) {
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [parseInt(ruleId)],
      addRules: []
    });
    updateStatus('Site removed from blocklist');
    loadBlockedSites();
  } catch (error) {
    updateStatus('Error removing site', true);
  }
}

// Function to clear all blocked sites
async function clearAllSites() {
  try {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: rules.map(rule => rule.id),
      addRules: []
    });
    updateStatus('All sites cleared from blocklist');
    loadBlockedSites();
  } catch (error) {
    updateStatus('Error clearing sites', true);
  }
}

// Function to export the blocked sites list
async function exportBlockedSites() {
  try {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    const domains = rules
      .map(rule => rule.condition.urlFilter.replace('||', ''))
      .sort()
      .join('\n');
    
    const blob = new Blob([domains], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blocked-sites.txt';
    a.click();
    URL.revokeObjectURL(url);
    
    updateStatus('Blocked sites list exported');
  } catch (error) {
    updateStatus('Error exporting sites list', true);
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  loadBlockedSites();
  
  // Toggle input section
  document.getElementById('toggleInput').addEventListener('click', () => {
    const inputSection = document.getElementById('inputSection');
    const isHidden = inputSection.style.display === 'none';
    inputSection.style.display = isHidden ? 'block' : 'none';
    document.getElementById('toggleInput').textContent = 
      isHidden ? 'Cancel' : 'Add Sites';
  });
  
  // Add sites button
  document.getElementById('addSites').addEventListener('click', () => {
    const input = document.getElementById('siteInput');
    const domains = input.value
      .split('\n')
      .map(sanitizeDomain)
      .filter(domain => isValidDomain(domain));
    
    if (domains.length === 0) {
      updateStatus('Please enter valid domains', true);
      return;
    }
    
    addBlockedSites(domains);
    input.value = '';
    document.getElementById('inputSection').style.display = 'none';
    document.getElementById('toggleInput').textContent = 'Add Sites';
  });
  
  // Cancel add button
  document.getElementById('cancelAdd').addEventListener('click', () => {
    document.getElementById('siteInput').value = '';
    document.getElementById('inputSection').style.display = 'none';
    document.getElementById('toggleInput').textContent = 'Add Sites';
  });
  
  // Remove site buttons
  document.getElementById('siteList').addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-rule-id')) {
      const ruleId = e.target.getAttribute('data-rule-id');
      removeBlockedSite(ruleId);
    }
  });
  
  // Clear all button
  document.getElementById('clearAll').addEventListener('click', () => {
    if (confirm('Are you sure you want to remove all blocked sites?')) {
      clearAllSites();
    }
  });
  
  // Export list button
  document.getElementById('exportList').addEventListener('click', exportBlockedSites);
});
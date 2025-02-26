// RFA filtering and search functionality
document.addEventListener('DOMContentLoaded', () => {
    // Get filter elements
    const searchInput = document.getElementById('search');
    const tagFilters = document.querySelectorAll('.tag-filter');
    const statusFilters = document.querySelectorAll('.status-filter');
    const rfaCards = document.querySelectorAll('.rfa-card');

    // Search functionality
    function filterRFAs() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedTags = Array.from(tagFilters)
            .filter(tag => tag.checked)
            .map(tag => tag.value);
        const selectedStatuses = Array.from(statusFilters)
            .filter(status => status.checked)
            .map(status => status.value);

        rfaCards.forEach(card => {
            const title = card.querySelector('h2').textContent.toLowerCase();
            const description = card.querySelector('.description').textContent.toLowerCase();
            const tags = Array.from(card.querySelectorAll('.tag')).map(tag => tag.textContent);
            const status = card.querySelector('.rfa-status').textContent;

            const matchesSearch = title.includes(searchTerm) || description.includes(searchTerm);
            const matchesTags = selectedTags.length === 0 || selectedTags.some(tag => tags.includes(tag));
            const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(status);

            card.style.display = matchesSearch && matchesTags && matchesStatus ? 'block' : 'none';
        });
    }

    // Event listeners
    searchInput?.addEventListener('input', filterRFAs);
    tagFilters.forEach(filter => filter.addEventListener('change', filterRFAs));
    statusFilters.forEach(filter => filter.addEventListener('change', filterRFAs));

    // Initialize mermaid diagrams
    if (window.mermaid) {
        mermaid.initialize({ startOnLoad: true });
    }
}); 
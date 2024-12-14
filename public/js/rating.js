document.addEventListener("DOMContentLoaded", () => {
    const ratingDivs = document.querySelectorAll('.rating');

    ratingDivs.forEach(div => {
        const randomRating = Math.floor(Math.random() * 5) + 1;
        
        // Generate stars based on rating
        div.innerHTML = "★".repeat(randomRating) + "<span class='empty-star'>☆</span>".repeat(5 - randomRating);
    });
});

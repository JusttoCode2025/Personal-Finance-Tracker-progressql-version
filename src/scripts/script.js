document.addEventListener('DOMContentLoaded', () => {

    /* login */

    const submitBtn = document.getElementById('submit-btn');

    if (submitBtn) {
        submitBtn.addEventListener('click', () => {

            const emailInput = document.querySelector('#email');
            const passwordInput = document.querySelector('#password');

            const validEmail = "group1@gmail.com";
            const validPassword = "group1";

            if (emailInput.value === validEmail && passwordInput.value === validPassword) {
                alert("Success! You are now logged in.");
                window.location.href = "/home";
            } else {
                alert("Error: Invalid email or password.");
            }
        });
    }


    /* home travel bar */

    const homeSaved = parseFloat(localStorage.getItem("travel_saved")) || 0;
    const homeGoal = parseFloat(localStorage.getItem("travel_goal")) || 0;

    if (homeGoal > 0) {

        const percent = (homeSaved / homeGoal) * 100;
        const remaining = homeGoal - homeSaved;

        const homeBar = document.getElementById("homeTravelProgress");
        const homePercent = document.getElementById("homeTravelPercent");
        const homeSavedText = document.getElementById("homeGoalSaved");
        const homeLeftText = document.getElementById("homeGoalLeft");
        const homeRemainingText = document.getElementById("homeGoalRemainingText");

        if (homeBar) homeBar.style.width = percent + "%";
        if (homePercent) homePercent.textContent = percent.toFixed(1) + "%";
        if (homeSavedText) homeSavedText.textContent = "$" + homeSaved.toFixed(0);
        if (homeLeftText) homeLeftText.textContent = "$" + remaining.toFixed(0);
        if (homeRemainingText) homeRemainingText.textContent = "$" + remaining.toFixed(0) + " left";
    }


    /* travel pg */

    const goalInput = document.getElementById("goalAmount");
    const contributionInput = document.getElementById("contributionAmount");
    const addBtn = document.getElementById("addBtn");
    const resetBtn = document.getElementById("resetGoal");

    if (goalInput && addBtn) {

        let totalSaved = parseFloat(localStorage.getItem("travel_saved")) || 0;
        let savedGoal = parseFloat(localStorage.getItem("travel_goal")) || 0;

        if (savedGoal > 0) {
            goalInput.value = savedGoal;
            updateUI(totalSaved, savedGoal);
        }

        addBtn.addEventListener("click", () => {

            const goal = parseFloat(goalInput.value);
            const contribution = parseFloat(contributionInput.value);

            if (!goal || goal <= 0) {
                alert("Please enter a valid goal amount.");
                return;
            }

            if (goal > 10000) {
                const confirmGoal = confirm(
                    "Your goal is over $10,000. Are you sure this is correct?"
                );
                if (!confirmGoal) return;
            }

            if (!contribution || contribution <= 0) {
                alert("Please enter a valid contribution.");
                return;
            }

            if (contribution > goal) {
                alert("Contribution cannot be greater than the goal.");
                return;
            }

            if (contribution > goal * 0.5) {
                const confirmLarge = confirm(
                    "This contribution is more than half of your goal. Continue?"
                );
                if (!confirmLarge) return;
            }

            totalSaved += contribution;

            if (totalSaved > goal) totalSaved = goal;

            localStorage.setItem("travel_goal", goal);
            localStorage.setItem("travel_saved", totalSaved);

            updateUI(totalSaved, goal);

            contributionInput.value = "";
        });

        if (resetBtn) {
            resetBtn.addEventListener("click", () => {

                localStorage.removeItem("travel_goal");
                localStorage.removeItem("travel_saved");

                location.reload();
            });
        }
    }


    const categoryTable = document.getElementById("categoryTable");

    if (categoryTable) {
        loadCategories();
        loadRecentPurchases();
    }

});


/*limit */

async function setCategoryLimit() {

    const category = document.getElementById("limitCategory")?.value;
    const limit = parseFloat(document.getElementById("categoryLimit")?.value);

    if (!category || !limit) {
        alert("Please select a category and enter a limit.");
        return;
    }

    if (limit > 1000) {

        const confirmLimit = confirm(
            "This limit is over $1,000. Are you sure?"
        );

        if (!confirmLimit) return;
    }
   

    await fetch("/limit", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            category: category,
            limit_amount: limit
        })
    });

    loadCategories();
}



async function loadCategories() {

    const res = await fetch("/limits");
    const data = await res.json();

    const list = document.getElementById("categoryTable");
    if (!list) return;

    list.innerHTML = "";

    data.forEach(c => {

        const spent = c.limit_amount - c.remaining;

        list.innerHTML += `
            <li>
                <span><strong>${c.category}</strong></span>
                <span>Limit: $${c.limit_amount}</span>
                <span>Spent: $${spent}</span>
                <span>Remaining: $${c.remaining}</span>
            </li>
        `;
    });
}


/* purchases */

async function loadRecentPurchases() {

    const res = await fetch("/recent_purchases");
    const data = await res.json();

    const list = document.getElementById("recentPurchases");
    if (!list) return;

    list.innerHTML = "";

    if (data.length === 0) {
        list.innerHTML = `<li class="empty-state">No purchases yet.</li>`;
        return;
    }

    data.forEach(p => {

        list.innerHTML += `
            <li>
                <span><strong>${p.category}</strong></span>
                <span>$${p.amount}</span>
                <span>${p.date}</span>
            </li>
        `;
    });
}


async function addPurchase() {

    const category = document.getElementById("purchaseCategory").value;
    const amount = parseFloat(document.getElementById("purchaseAmount").value);
    const msg = document.getElementById("purchaseMessage");

    if (!category || !amount) {
        msg.textContent = "Please select a category and enter an amount.";
        msg.style.color = "red";
        return;
    }

    const res = await fetch("/purchase", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            category: category,
            amount: amount
        })
    });

    const data = await res.json();

    
    if (data.error) {
        msg.textContent = data.error;
        msg.style.color = "red";
        return;
    }

   
    if (data.warning) {

        const confirmSpend = confirm(data.warning + "\n\nContinue anyway?");

        if (!confirmSpend) {
            msg.textContent = "Purchase cancelled.";
            msg.style.color = "orange";
            return;
        }

        await fetch("/purchase", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                category: category,
                amount: amount,
                confirm: true
            })
        });
    }

    msg.textContent = "Purchase added.";
    msg.style.color = "green";

    loadRecentPurchases();
    loadCategories();
}
/* travel bar*/

function updateUI(saved, goal) {

    const percent = (saved / goal) * 100;
    const remaining = goal - saved;

    const progressBar = document.getElementById("travelProgress");
    const percentText = document.getElementById("travelPercent");
    const savedText = document.getElementById("goalSaved");
    const leftText = document.getElementById("goalLeft");
    const remainingBarText = document.getElementById("goalRemainingText");
    const summary = document.getElementById("goalSummary");
    const celebrate = document.getElementById("goalCelebrate");

    if (progressBar) progressBar.style.width = percent + "%";
    if (percentText) percentText.textContent = percent.toFixed(1) + "%";
    if (savedText) savedText.textContent = "$" + saved.toFixed(0);
    if (leftText) leftText.textContent = "$" + remaining.toFixed(0);
    if (remainingBarText) remainingBarText.textContent = "$" + remaining.toFixed(0) + " left";

    if (summary) {
        summary.textContent =
            `Saved: $${saved.toFixed(2)} / $${goal.toFixed(2)} (${percent.toFixed(1)}%)`;
    }

    if (celebrate) {

        if (percent >= 100) {
            celebrate.textContent = "Congratulations! You've reached your travel goal!";
            progressBar.style.background =
                "linear-gradient(90deg, #2e7d32, #4caf50)";
        }
        else if (percent >= 75) celebrate.textContent = "Almost there!";
        else if (percent >= 50) celebrate.textContent = "Halfway there!";
        else if (percent >= 25) celebrate.textContent = "Great start!";
        else celebrate.textContent = "";
    }
}


function dummy() {
    const message = document.createElement("p");
    message.textContent = "you clicked a button";

    document.body.appendChild(message);

    setTimeout(function() {
        message.remove();
    }, 5000);
}
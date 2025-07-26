// Create background particles
function createParticles() {
    const container = document.getElementById('particles');
    const particleCount = 30;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        
        // Random size
        const size = Math.random() * 6 + 2;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        
        // Random position
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        
        // Random animation
        const duration = Math.random() * 20 + 10;
        particle.style.animation = `float ${duration}s infinite ease-in-out`;
        
        container.appendChild(particle);
    }
}

// Float animation for particles
const style = document.createElement('style');
style.textContent = `
    @keyframes float {
        0% { transform: translateY(0) translateX(0) rotate(0deg); }
        50% { transform: translateY(-20px) translateX(10px) rotate(180deg); }
        100% { transform: translateY(0) translateX(0) rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Initialize GSAP ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

// Animate sections on scroll
document.querySelectorAll('.section').forEach((section, index) => {
    gsap.fromTo(section, 
        { opacity: 0, y: 50 },
        {
            opacity: 1,
            y: 0,
            duration: 0.8,
            scrollTrigger: {
                trigger: section,
                start: "top 80%",
                toggleActions: "play none none none"
            }
        }
    );
});

// Navigation functionality
const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.section');

// Set active nav item on click
navItems.forEach(item => {
    item.addEventListener('click', function() {
        const sectionId = this.getAttribute('data-section');
        
        // Remove active class from all items
        navItems.forEach(navItem => {
            navItem.classList.remove('active');
        });
        
        // Add active class to clicked item
        this.classList.add('active');
        
        // Scroll to section
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            window.scrollTo({
                top: targetSection.offsetTop - 100,
                behavior: 'smooth'
            });
        }
    });
});

// Set active nav item on scroll
window.addEventListener('scroll', function() {
    let currentSection = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        
        if (pageYOffset >= (sectionTop - sectionHeight / 3)) {
            currentSection = section.getAttribute('id');
        }
    });
    
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-section') === currentSection) {
            item.classList.add('active');
        }
    });
});

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    createParticles();
    
    // Initialize first section as active
    navItems[0].classList.add('active');
    
    // Add floating effect to logo
    gsap.to('.logo-icon', {
        y: 5,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut"
    });
});
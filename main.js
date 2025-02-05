document.getElementById('payment-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const formData = {
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    dob: document.getElementById('dob').value,
    course: document.getElementById('course').value,
    preferredDate: document.getElementById('preferredDate').value,
  };

  try {
    const response = await fetch('http://localhost:3000/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    const data = await response.json();

    if (response.ok) {
      payWithPaystack(data.registration.paymentReference, formData.email, 10000); // Example amount in kobo (10 GHS)
    } else {
      alert('Error: ' + data.message);
    }
  } catch (error) {
    alert('Error: ' + error.message);
  }
});

function payWithPaystack(reference, email, amount) {
  let handler = PaystackPop.setup({
    key: 'pk_test_a41de402287d366d071c2a73682ba46f15427b15', // Replace with your public key
    email: email,
    amount: amount,
    currency: 'GHS',
    ref: reference,
    onClose: function () {
      alert('Window closed.');
    },
    callback: async function (response) {
      try {
        const verifyResponse = await fetch('http://localhost:3000/api/payment/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reference: response.reference })
        });

        const verifyData = await verifyResponse.json();

        if (verifyResponse.ok) {
          alert('Payment complete! Reference: ' + response.reference);
        } else {
          alert('Payment verification failed: ' + verifyData.message);
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }
  });

  handler.openIframe();
}

// Navbar scroll effect
window.addEventListener('scroll', function() {
  const navbar = document.querySelector('.navbar');
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

// Hamburger menu toggle
function toggleMenu() {
  const navMenu = document.getElementById("nav-menu");
  navMenu.classList.toggle("active");
}

// Intersection Observer for scroll animations
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
});

// Observe all animated elements
document.querySelectorAll('.course-item, .testimonial-item, .instructor-item, .contact form').forEach((el) => {
  observer.observe(el);
});

const modal = document.getElementById("payment-modal");

// Get the button that opens the modal
const ctaButton = document.querySelector(".cta-button");

// Get the <span> element that closes the modal
const closeButton = document.getElementsByClassName("close-button")[0];

// When the user clicks on the button, open the modal
ctaButton.onclick = function() {
  modal.style.display = "block";
  document.querySelector(".main").classList.add("blurred");
};

// When the user clicks on <span> (x), close the modal
closeButton.onclick = function() {
  modal.style.display = "none";
  document.querySelector(".main").classList.remove("blurred");
};

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = "none";
    document.querySelector(".main").classList.remove("blurred");
  }
};

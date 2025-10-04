// Localization dictionary (English CamelCase & Hindi)
const LOCALE = {
  english: {
    greeting: 'Hi',
    chooseOption: 'Choose an option — Type the number or tap a button:',
    orderMedicine: 'Order Medicine',
    bookAppointment: 'Book Appointment',
    myOrders: 'My Orders',
    contactUs: 'Contact Us',
    exit: 'Exit',
    registerFirst: 'Please register first to place an order.',
    whichLanguage: 'Which language do you prefer? Type "English" or "Hindi"',
    invalidLanguage: 'Please select a valid language. Type "English" or "Hindi".',
    enterName: 'What is your full name?',
    enterPhone: 'Please enter your phone number (eg: +918369242977)',
    enterEmail: 'Please enter your email (required)',
    creatingProfile: 'Creating your profile...',
    profileCreated: 'Registered successfully.',
    fillOrderDetails: 'Please fill order details below:',
    placeOrderSuccess: 'Your order has been placed. Confirmation email sent.',
    fillAppointmentDetails: 'Please fill appointment details below:',
    appointmentSuccess: 'Appointment booked. Confirmation email sent.',
    noOrders: 'No orders found.',
    viewOrders: 'View My Orders',
    backToMenu: 'Back to Menu',
    confirm: 'Confirm',
    goBack: 'Go back to Menu',
    pleaseFill: 'Please fill all required fields.',
    uploadPrescription: 'Upload Prescription (Optional)',
    medicinePlaceholder: 'e.g. Paracetamol',
    addressPlaceholder: 'Delivery Address',
    typeMessagePlaceholder: "Type a message... (try 'Hi' or 'menu')",
    profileLabel: 'Profile',
    registerLabel: 'Register',
    logoutLabel: 'Logout',
    loading: 'Loading...',
    error: 'An error occurred. Please try again.',
    success: 'Success!',
    cancel: 'Cancel',
    submit: 'Submit',
    retry: 'Retry',
    welcome: 'Welcome to Ranjan Medicine Chatbot',
    help: 'Help',
    settings: 'Settings'
  },
  hindi: {
    greeting: 'नमस्ते',
    chooseOption: 'एक विकल्प चुनें — संख्या टाइप करें या बटन दबाएँ:',
    orderMedicine: 'दवा ऑर्डर',
    bookAppointment: 'अपॉइंटमेंट बुक करें',
    myOrders: 'मेरे ऑर्डर',
    contactUs: 'संपर्क करें',
    exit: 'बाहर जाएं',
    registerFirst: 'कृपया ऑर्डर करने से पहले पंजीकरण करें।',
    whichLanguage: 'कृपया भाषा चुनें: "English" या "Hindi"',
    invalidLanguage: 'कृपया एक वैध भाषा चुनें। "English" या "Hindi" टाइप करें।',
    enterName: 'अपना पूरा नाम बताइए',
    enterPhone: 'कृपया अपना फ़ोन नंबर दें (उदा: +918369242977)',
    enterEmail: 'कृपया अपना ईमेल दें (अनिवार्य)',
    creatingProfile: 'आपकी प्रोफ़ाइल बनाई जा रही है...',
    profileCreated: 'आप सफलतापूर्वक पंजीकृत हो गए हैं।',
    fillOrderDetails: 'कृपया नीचे ऑर्डर विवरण भरें:',
    placeOrderSuccess: 'आपका ऑर्डर दे दिया गया है। पुष्टि ईमेल भेज दी गई है।',
    fillAppointmentDetails: 'कृपया अपॉइंटमेंट विवरण भरें:',
    appointmentSuccess: 'अपॉइंटमेंट बुक कर दी गई है। पुष्टि ईमेल भेज दी गई है।',
    noOrders: 'कोई ऑर्डर नहीं मिला।',
    viewOrders: 'मेरे ऑर्डर देखें',
    backToMenu: 'मेन्यू पर वापस जाएं',
    confirm: 'पुष्टि करें',
    goBack: 'मेन्यू पर वापस जाएं',
    pleaseFill: 'कृपया सभी आवश्यक फ़ील्ड भरें।',
    uploadPrescription: 'प्रिस्क्रिप्शन अपलोड करें (वैकल्पिक)',
    medicinePlaceholder: 'उदा. पेरासिटामोल',
    addressPlaceholder: 'डिलीवरी पता',
    typeMessagePlaceholder: "संदेश लिखें... (Hi या menu)",
    profileLabel: 'प्रोफ़ाइल',
    registerLabel: 'रजिस्टर',
    logoutLabel: 'लॉगआउट',
    loading: 'लोड हो रहा है...',
    error: 'एक त्रुटि हुई। कृपया पुनः प्रयास करें।',
    success: 'सफलता!',
    cancel: 'रद्द करें',
    submit: 'सबमिट करें',
    retry: 'पुनः प्रयास करें',
    welcome: 'रंजन मेडिसिन चैटबॉट में आपका स्वागत है',
    help: 'सहायता',
    settings: 'सेटिंग्स'
  }
};

// Translation function
export const t = (lang, key) => {
  if (!LOCALE[lang]) return LOCALE['english'][key] || key;
  return LOCALE[lang][key] || LOCALE['english'][key] || key;
};

// Get available languages
export const getAvailableLanguages = () => Object.keys(LOCALE);

// Validate language
export const isValidLanguage = (lang) => getAvailableLanguages().includes(lang);

export default LOCALE;

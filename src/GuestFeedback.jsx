import { useEffect, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const BOOKING_SOURCES = [
  { value: 'Booking.com', icon: 'fa-solid fa-b' },
  { value: 'Ctrip', icon: 'fa-solid fa-plane-departure' },
  { value: 'Agoda', icon: 'fa-solid fa-a' },
  { value: 'Other', icon: 'fa-solid fa-ellipsis' }
];

const EMPTY_FORM = {
  name: '',
  contact: '',
  remark: '',
  source: '',
  otherSource: ''
};

export default function GuestFeedback() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    document.body.classList.add('guest-feedback-body');
    const previousTitle = document.title;
    document.title = 'Guest Review & Feedback | Aladdin Dream Hotel';

    return () => {
      document.body.classList.remove('guest-feedback-body');
      document.title = previousTitle;
    };
  }, []);

  const updateField = (field, value) => {
    setForm(current => ({
      ...current,
      [field]: value,
      ...(field === 'source' && value !== 'Other' ? { otherSource: '' } : {})
    }));
    if (feedback.message) setFeedback({ type: '', message: '' });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    const contact = form.contact.trim();
    const remark = form.remark.trim();
    const otherSource = form.otherSource.trim();

    if (!name || !contact || !remark || !form.source) {
      setFeedback({ type: 'error', message: 'Please complete all required fields.' });
      return;
    }

    if (form.source === 'Other' && !otherSource) {
      setFeedback({ type: 'error', message: 'Please tell us where you booked or found us.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback({ type: '', message: '' });

    try {
      await addDoc(collection(db, 'guestFeedback'), {
        name,
        contact,
        remark,
        source: form.source,
        otherSource: form.source === 'Other' ? otherSource : '',
        submittedAt: serverTimestamp()
      });
      setForm(EMPTY_FORM);
      setIsSubmitted(true);
    } catch (error) {
      console.error('Guest feedback submission failed:', error);
      setFeedback({
        type: 'error',
        message: 'We could not send your feedback right now. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <main className="guest-feedback-page">
        <section className="guest-feedback-shell guest-feedback-thank-you" aria-live="polite">
          <div className="guest-feedback-success-icon">
            <i className="fa-solid fa-check" aria-hidden="true"></i>
          </div>
          <span className="guest-feedback-kicker">Feedback received</span>
          <h1>Thank you for sharing.</h1>
          <p>Your comments help us create an even better stay for every guest.</p>
          <button type="button" onClick={() => setIsSubmitted(false)}>
            Submit another response
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="guest-feedback-page">
      <section className="guest-feedback-shell">
        <header className="guest-feedback-hero">
          <div className="guest-feedback-brand-mark" aria-hidden="true">AD</div>
          <div>
            <span>Aladdin Dream Hotel</span>
            <strong>Guest Experience</strong>
          </div>
        </header>

        <div className="guest-feedback-intro">
          <span className="guest-feedback-kicker">We value your experience</span>
          <h1>Guest Review &amp; Feedback</h1>
          <p>Tell us about your stay. Your feedback helps our team serve you better.</p>
        </div>

        <form className="guest-feedback-form" onSubmit={handleSubmit} noValidate>
          <div className="guest-feedback-field-grid">
            <label className="guest-feedback-field">
              <span>Name <em>Required</em></span>
              <div className="guest-feedback-input-wrap">
                <i className="fa-regular fa-user" aria-hidden="true"></i>
                <input
                  type="text"
                  value={form.name}
                  onChange={event => updateField('name', event.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  maxLength="100"
                  required
                />
              </div>
            </label>

            <label className="guest-feedback-field">
              <span>Contact <em>Required</em></span>
              <div className="guest-feedback-input-wrap">
                <i className="fa-solid fa-phone" aria-hidden="true"></i>
                <input
                  type="text"
                  value={form.contact}
                  onChange={event => updateField('contact', event.target.value)}
                  placeholder="Phone number or email"
                  autoComplete="tel"
                  maxLength="100"
                  required
                />
              </div>
            </label>
          </div>

          <fieldset className="guest-feedback-source">
            <legend>Where did you book or find us? <em>Required</em></legend>
            <div className="guest-feedback-source-grid">
              {BOOKING_SOURCES.map(source => (
                <label key={source.value} className={form.source === source.value ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="bookingSource"
                    value={source.value}
                    checked={form.source === source.value}
                    onChange={event => updateField('source', event.target.value)}
                    required
                  />
                  <i className={source.icon} aria-hidden="true"></i>
                  <span>{source.value}</span>
                  <b><i className="fa-solid fa-check" aria-hidden="true"></i></b>
                </label>
              ))}
            </div>
          </fieldset>

          {form.source === 'Other' && (
            <label className="guest-feedback-field guest-feedback-other-field">
              <span>Please specify <em>Required</em></span>
              <div className="guest-feedback-input-wrap">
                <i className="fa-solid fa-pen" aria-hidden="true"></i>
                <input
                  type="text"
                  value={form.otherSource}
                  onChange={event => updateField('otherSource', event.target.value)}
                  placeholder="Write the booking platform or source"
                  maxLength="100"
                  autoFocus
                  required
                />
              </div>
            </label>
          )}

          <label className="guest-feedback-field guest-feedback-remark-field">
            <span>Remark / Feedback <em>Required</em></span>
            <textarea
              value={form.remark}
              onChange={event => updateField('remark', event.target.value)}
              placeholder="Share your experience with us..."
              rows="6"
              maxLength="1500"
              required
            />
            <small>{form.remark.length} / 1500</small>
          </label>

          {feedback.message && (
            <p className={`guest-feedback-message ${feedback.type}`} role="alert">
              <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
              {feedback.message}
            </p>
          )}

          <button className="guest-feedback-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Sending...</>
            ) : (
              <>Submit Feedback <i className="fa-solid fa-arrow-right" aria-hidden="true"></i></>
            )}
          </button>
        </form>

        <footer className="guest-feedback-footer">
          <i className="fa-solid fa-lock" aria-hidden="true"></i>
          Your information is used only to follow up on your feedback.
        </footer>
      </section>
    </main>
  );
}

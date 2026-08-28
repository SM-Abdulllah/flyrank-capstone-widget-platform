async function sendSubmissionNotification(payload) {
  const mode = payload.side_effect_mode || process.env.SIDE_EFFECT_MODE || 'success';

  if (mode === 'fail') {
    throw new Error('Notification side effect forced to fail');
  }

  console.log('Notification side effect completed', {
    submissionId: payload.submission_id,
    widgetPublicId: payload.widget_public_id
  });
}

module.exports = {
  sendSubmissionNotification
};

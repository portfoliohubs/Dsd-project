/**
 * Dentiscan DSD - Sample Patient Clinical Portraits Generator
 * Generates realistic clinical facial & dental photographic plates
 * directly via Canvas 2D without external network dependencies.
 */

window.DSD_SAMPLE_DATA = {
  getSamplePortrait(type = 'coachman_master') {
    if (type === 'coachman_master') {
      return './assets/dsd/image107.jpeg';
    }
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');

    if (type === 'female_smile') {
      this.renderFemaleSmile(ctx, 1000, 700);
    } else if (type === 'male_smile') {
      this.renderMaleSmile(ctx, 1000, 700);
    } else {
      this.renderRetractedIntraoral(ctx, 1000, 700);
    }

    return canvas.toDataURL('image/jpeg', 0.95);
  },

  renderFemaleSmile(ctx, w, h) {
    // Soft studio background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#f1f5f9');
    bgGrad.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Face / Skin Tone
    ctx.save();
    const faceGrad = ctx.createRadialGradient(w / 2, h / 2 - 20, 50, w / 2, h / 2 - 20, 380);
    faceGrad.addColorStop(0, '#f9dfd1');
    faceGrad.addColorStop(0.7, '#f4cfbc');
    faceGrad.addColorStop(1, '#e3b6a0');
    ctx.fillStyle = faceGrad;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2 - 20, 240, 310, 0, 0, Math.PI * 2);
    ctx.fill();

    // Soft Cheeks Contour
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    ctx.beginPath();
    ctx.arc(w / 2 - 130, h / 2 + 30, 60, 0, Math.PI * 2);
    ctx.arc(w / 2 + 130, h / 2 + 30, 60, 0, Math.PI * 2);
    ctx.fill();

    // Eyes / Interpupillary Reference Region
    const eyeY = h / 2 - 120;
    [-105, 105].forEach(dx => {
      const ex = w / 2 + dx;
      // Sclera
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 32, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Iris
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(ex, eyeY, 12, 0, Math.PI * 2);
      ctx.fill();

      // Pupil
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(ex, eyeY, 5, 0, Math.PI * 2);
      ctx.fill();

      // Catchlight
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 3, eyeY - 3, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Upper Eyelash / Eyebrow
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(ex, eyeY - 26, 36, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    });

    // Nose
    ctx.strokeStyle = '#c99a84';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(w / 2, eyeY + 25);
    ctx.lineTo(w / 2, eyeY + 95);
    ctx.bezierCurveTo(w / 2 - 25, eyeY + 115, w / 2 + 25, eyeY + 115, w / 2, eyeY + 95);
    ctx.stroke();

    // Lips & Smile Opening
    const mouthY = h / 2 + 115;
    // Oral Cavity (Dark background)
    ctx.fillStyle = '#1e1b1b';
    ctx.beginPath();
    ctx.ellipse(w / 2, mouthY, 125, 38, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lower natural teeth visible in background
    ctx.fillStyle = '#f8fafc';
    for (let i = -4; i <= 4; i++) {
      ctx.fillRect(w / 2 + i * 16 - 7, mouthY + 14, 14, 16);
    }

    // Upper Natural Dentition (Pre-op baseline to design over)
    const teethProps = [
      { dx: -68, w: 16, h: 26, r: 10 }, // Pre-molar
      { dx: -48, w: 18, h: 32, r: 8 },  // Canine
      { dx: -28, w: 19, h: 30, r: 6 },  // Lateral (mildly rotated/short)
      { dx: -9.5, w: 21, h: 35, r: 4 }, // Central
      { dx: 9.5, w: 21, h: 34, r: 4 },  // Central (slight asymmetry)
      { dx: 28, w: 19, h: 29, r: 6 },   // Lateral
      { dx: 48, w: 18, h: 32, r: 8 },   // Canine
      { dx: 68, w: 16, h: 26, r: 10 }   // Pre-molar
    ];

    teethProps.forEach(t => {
      ctx.save();
      const grad = ctx.createLinearGradient(0, mouthY - 15, 0, mouthY + t.h);
      grad.addColorStop(0, '#fef08a'); // natural slightly warm enamel
      grad.addColorStop(0.3, '#fef9c3');
      grad.addColorStop(1, '#ffffff');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;

      ctx.beginPath();
      const x = w / 2 + t.dx - t.w / 2;
      const y = mouthY - 18;
      ctx.roundRect(x, y, t.w, t.h, [4, 4, 3, 3]);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    // Natural Gingiva (Gums)
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.ellipse(w / 2, mouthY - 20, 110, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Upper Lip Vermilion Border
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 130, mouthY - 4);
    // Cupid's bow
    ctx.bezierCurveTo(w / 2 - 70, mouthY - 24, w / 2 - 25, mouthY - 32, w / 2 - 8, mouthY - 28);
    ctx.lineTo(w / 2, mouthY - 24);
    ctx.lineTo(w / 2 + 8, mouthY - 28);
    ctx.bezierCurveTo(w / 2 + 25, mouthY - 32, w / 2 + 70, mouthY - 24, w / 2 + 130, mouthY - 4);
    // Inner upper lip curve
    ctx.bezierCurveTo(w / 2 + 60, mouthY - 10, w / 2 - 60, mouthY - 10, w / 2 - 130, mouthY - 4);
    ctx.fill();

    // Lower Lip
    ctx.beginPath();
    ctx.moveTo(w / 2 - 130, mouthY - 4);
    // Outer lower lip curve
    ctx.bezierCurveTo(w / 2 - 70, mouthY + 54, w / 2 + 70, mouthY + 54, w / 2 + 130, mouthY - 4);
    // Inner lower lip curve
    ctx.bezierCurveTo(w / 2 + 70, mouthY + 32, w / 2 - 70, mouthY + 32, w / 2 - 130, mouthY - 4);
    ctx.fill();

    // Lip highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.ellipse(w / 2, mouthY + 38, 48, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Clinical Metadata Watermark
    ctx.fillStyle = '#64748b';
    ctx.font = '500 13px Inter, sans-serif';
    ctx.fillText('Patient #1042 · Full Facial Smile View · Pre-Operative Baseline', 24, h - 24);
    ctx.restore();
  },

  renderMaleSmile(ctx, w, h) {
    // Darker studio background
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, w, h);

    // Warm tanned skin tone
    ctx.save();
    const faceGrad = ctx.createRadialGradient(w / 2, h / 2 - 10, 40, w / 2, h / 2 - 10, 360);
    faceGrad.addColorStop(0, '#eed0b7');
    faceGrad.addColorStop(0.7, '#deba9d');
    faceGrad.addColorStop(1, '#c29777');
    ctx.fillStyle = faceGrad;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2 - 10, 250, 320, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const eyeY = h / 2 - 110;
    [-110, 110].forEach(dx => {
      const ex = w / 2 + dx;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 30, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(ex, eyeY, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(ex, eyeY - 24, 38, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    });

    // Oral cavity
    const mouthY = h / 2 + 110;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(w / 2, mouthY, 135, 42, 0, 0, Math.PI * 2);
    ctx.fill();

    // Teeth with worn incisal edges (typical esthetic wear case)
    const teethProps = [
      { dx: -70, w: 17, h: 24 },
      { dx: -50, w: 18, h: 28 },
      { dx: -30, w: 19, h: 26 },
      { dx: -10, w: 22, h: 29 }, // worn central
      { dx: 10,  w: 22, h: 29 }, // worn central
      { dx: 30,  w: 19, h: 26 },
      { dx: 50,  w: 18, h: 28 },
      { dx: 70,  w: 17, h: 24 }
    ];

    teethProps.forEach(t => {
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(w / 2 + t.dx - t.w / 2, mouthY - 14, t.w, t.h, [3, 3, 2, 2]);
      ctx.fill();
      ctx.stroke();
    });

    // Lips
    ctx.fillStyle = '#be123c';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 140, mouthY - 2);
    ctx.bezierCurveTo(w / 2 - 70, mouthY - 28, w / 2 + 70, mouthY - 28, w / 2 + 140, mouthY - 2);
    ctx.bezierCurveTo(w / 2 + 70, mouthY - 10, w / 2 - 70, mouthY - 10, w / 2 - 140, mouthY - 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(w / 2 - 140, mouthY - 2);
    ctx.bezierCurveTo(w / 2 - 70, mouthY + 50, w / 2 + 70, mouthY + 50, w / 2 + 140, mouthY - 2);
    ctx.bezierCurveTo(w / 2 + 70, mouthY + 34, w / 2 - 70, mouthY + 34, w / 2 - 140, mouthY - 2);
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '500 13px Inter, sans-serif';
    ctx.fillText('Patient #2088 · Male Smile Esthetic Analysis · Incisal Wear Case', 24, h - 24);
    ctx.restore();
  },

  renderRetractedIntraoral(ctx, w, h) {
    // Clinical black backdrop (Intraoral contrastor)
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Retractor curves
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(80, h / 2, 140, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w - 80, h / 2, 140, Math.PI * 0.6, Math.PI * 1.4);
    ctx.stroke();

    // High definition gingival tissue
    const cy = h / 2 - 10;
    ctx.fillStyle = '#fb7185';
    ctx.beginPath();
    ctx.ellipse(w / 2, cy - 80, 360, 90, 0, 0, Math.PI * 2);
    ctx.fill();

    // Retracted maxillary teeth with diastema and incisal notch
    const teeth = [
      { dx: -180, w: 42, h: 80, name: '#15' },
      { dx: -125, w: 45, h: 90, name: '#14' },
      { dx: -75,  w: 48, h: 105, name: '#13' },
      { dx: -35,  w: 36, h: 92, name: '#12' },
      { dx: -12,  w: 44, h: 108, name: '#11' }, // Midline diastema
      { dx: 14,   w: 44, h: 108, name: '#21' },
      { dx: 45,   w: 36, h: 92, name: '#22' },
      { dx: 85,   w: 48, h: 105, name: '#23' },
      { dx: 135,  w: 45, h: 90, name: '#24' },
      { dx: 190,  w: 42, h: 80, name: '#25' }
    ];

    teeth.forEach(t => {
      ctx.save();
      const grad = ctx.createLinearGradient(0, cy - 80, 0, cy + 60);
      grad.addColorStop(0, '#fef08a');
      grad.addColorStop(0.4, '#ffffff');
      grad.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.roundRect(w / 2 + t.dx - t.w / 2, cy - 65, t.w, t.h, [14, 14, 4, 4]);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    // Lower arch partially visible below
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(w / 2 - 200, cy + 120, 400, 70);

    // Intraoral scale calibration ruler on left side!
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(110, cy - 100, 18, 200);
    ctx.fillStyle = '#0f172a';
    for (let i = 0; i <= 20; i++) {
      const ry = cy - 100 + i * 10;
      const rLen = i % 5 === 0 ? 14 : 7;
      ctx.fillRect(110, ry, rLen, 1.5);
    }
    ctx.font = 'bold 11px monospace';
    ctx.fillText('20mm', 134, cy + 104);
    ctx.fillText('0mm', 134, cy - 94);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 13px Inter, sans-serif';
    ctx.fillText('Intraoral Retracted Frontal View · Calibrated 20mm Scale Bar Included', 24, h - 24);
  }
};

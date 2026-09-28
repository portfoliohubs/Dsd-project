/**
 * Dentiscan DSD Studio - Core Application Architecture
 * Fabric.js Canvas Controller, 2-Click Calibration, Multi-Format Exporter, Layer Manager
 */

(function () {
  'use strict';

  // Application Global State
  const state = {
    canvas: null,
    bgImage: null,
    bgOriginalDataUrl: null,
    patientName: 'Jane Doe',
    caseId: 'DSD-2026-041',
    clinicName: 'Aesthetic Dental & Smile Design Institute',
    clinicianName: 'Dr. Alex Mercer, DDS, FADFE',
    date: new Date().toISOString().split('T')[0],
    
    // Calibration State Machine
    // 'IDLE' | 'P1' | 'P2'
    calibrationState: 'IDLE',
    calibrationP1: null,
    calibrationTempLine: null,
    calibrationTempMarkerA: null,
    calibrationTempMarkerB: null,
    pixelDistance: 0,
    realMmDistance: 10.5,
    mmPerPixel: null, // mm = px * mmPerPixel
    pixelsPerMm: null, // px = mm * pixelsPerMm
    isCalibrated: false,

    // Reference Overlays State
    referenceLines: {
      midline: null,
      interpupillary: null,
      commissural: null,
      smileArc: null,
      zenithLine: null,
      goldenGrid: null
    },
    overlayVisibility: {
      midline: true,
      interpupillary: true,
      commissural: false,
      smileArc: false,
      zenithLine: false,
      goldenGrid: false
    },

    // Visagism Archetypes & Anatomic Tooth Library (from dsd_optimized.pptx)
    activeArchetype: 'oval', // 'oval' | 'triangular' | 'rectangular' | 'square'

    // Appearance Presets
    activeShade: 'bleach',
    shades: {
      bleach: { fill: 'rgba(255, 255, 255, 0.88)', stroke: '#2563eb', label: 'Bleach BL1' },
      a1:     { fill: 'rgba(254, 252, 232, 0.86)', stroke: '#2563eb', label: 'Natural A1' },
      a2:     { fill: 'rgba(254, 249, 195, 0.86)', stroke: '#1d4ed8', label: 'Warm A2' },
      a3:     { fill: 'rgba(253, 230, 138, 0.84)', stroke: '#1e40af', label: 'Aesthetic A3' },
      outline:{ fill: 'rgba(255, 255, 255, 0.15)', stroke: '#3b82f6', label: 'Wireframe' }
    },
    activeOpacity: 0.85,
    strokeWidth: 1.8,

    // History (Undo / Redo)
    history: [],
    historyIndex: -1,
    isHistoryProcessing: false,
    maxHistory: 25,

    // Active tool / mode
    activeTool: 'select', // 'select' | 'pan'
    isPanning: false,
    lastPanX: 0,
    lastPanY: 0
  };

  // Expose state globally for debugging / inspections
  window.dsdApp = { state };

  // ==========================================
  // INITIALIZATION
  // ==========================================
  document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    setupTouchGestures();
    setupMobileSheets();
    setupEventListeners();
    setupKeyboardShortcuts();
    loadInitialPatientSample('female_smile');
    updateCalibrationUI();
  });

  function initCanvas() {
    const canvasContainer = document.getElementById('canvas-viewport');
    if (!canvasContainer) return;

    const width = canvasContainer.clientWidth || 960;
    const height = canvasContainer.clientHeight || 640;

    state.canvas = new fabric.Canvas('dsd-canvas', {
      width: width,
      height: height,
      backgroundColor: '#090d16',
      preserveObjectStacking: true,
      selection: true,
      stopContextMenu: true,
      fireRightClick: true
    });

    // Custom controls styling (Adaptive for mobile touch & stylus)
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.innerWidth < 1024;
    fabric.Object.prototype.transparentCorners = false;
    fabric.Object.prototype.cornerColor = '#38bdf8';
    fabric.Object.prototype.cornerStrokeColor = '#ffffff';
    fabric.Object.prototype.borderColor = '#38bdf8';
    fabric.Object.prototype.cornerSize = isTouch ? 15 : 10;
    fabric.Object.prototype.touchCornerSize = 28;
    fabric.Object.prototype.borderScaleFactor = isTouch ? 2 : 1.5;
    fabric.Object.prototype.cornerStyle = 'circle';

    // Canvas Events
    state.canvas.on('mouse:down', onCanvasMouseDown);
    state.canvas.on('mouse:move', onCanvasMouseMove);
    state.canvas.on('mouse:up', onCanvasMouseUp);
    state.canvas.on('mouse:wheel', onCanvasMouseWheel);
    state.canvas.on('selection:created', onObjectSelected);
    state.canvas.on('selection:updated', onObjectSelected);
    state.canvas.on('selection:cleared', onSelectionCleared);
    state.canvas.on('object:modified', onObjectModified);
    state.canvas.on('object:added', updateLayerManager);
    state.canvas.on('object:removed', updateLayerManager);

    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('orientationchange', () => {
      setTimeout(fitDesignToViewport, 120);
      setTimeout(fitDesignToViewport, 350);
      setTimeout(fitDesignToViewport, 650);
    });
    if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', () => {
        setTimeout(fitDesignToViewport, 150);
        setTimeout(fitDesignToViewport, 400);
      });
    }
  }

  let resizeDebounceTimer = null;
  function handleWindowResize() {
    if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer);
    resizeDebounceTimer = setTimeout(() => {
      fitDesignToViewport();
    }, 100);
  }

  // Auto-fit & auto-center design to viewport regardless of portrait or landscape orientation
  function fitDesignToViewport() {
    const container = document.getElementById('canvas-viewport');
    if (!container || !state.canvas) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;

    state.canvas.setDimensions({ width: w, height: h });

    // 1. If background image exists, fit and center based on the patient image
    if (state.bgImage) {
      const imgW = state.bgImage.width * state.bgImage.scaleX;
      const imgH = state.bgImage.height * state.bgImage.scaleY;

      if (imgW > 0 && imgH > 0) {
        const marginFactor = 0.94;
        const scaleX = (w * marginFactor) / imgW;
        const scaleY = (h * marginFactor) / imgH;
        const fitZoom = Math.min(scaleX, scaleY, 2.5);

        const imgCenterX = state.bgImage.left;
        const imgCenterY = state.bgImage.top;

        const panX = (w / 2) - (imgCenterX * fitZoom);
        const panY = (h / 2) - (imgCenterY * fitZoom);

        state.canvas.setViewportTransform([fitZoom, 0, 0, fitZoom, panX, panY]);
        state.canvas.renderAll();
        updateZoomDisplay();
        return;
      }
    }

    // 2. If no background image, fit around visible non-overlay objects
    const objects = state.canvas.getObjects().filter(o => o.visible && o.dsdType !== 'overlay');
    if (objects.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      objects.forEach(obj => {
        const bound = obj.getBoundingRect(true, true);
        if (bound.left < minX) minX = bound.left;
        if (bound.top < minY) minY = bound.top;
        if (bound.left + bound.width > maxX) maxX = bound.left + bound.width;
        if (bound.top + bound.height > maxY) maxY = bound.top + bound.height;
      });

      const bboxW = maxX - minX;
      const bboxH = maxY - minY;
      if (bboxW > 0 && bboxH > 0) {
        const fitZoom = Math.min((w * 0.92) / bboxW, (h * 0.92) / bboxH, 2.0);
        const centerX = minX + bboxW / 2;
        const centerY = minY + bboxH / 2;
        const panX = (w / 2) - (centerX * fitZoom);
        const panY = (h / 2) - (centerY * fitZoom);

        state.canvas.setViewportTransform([fitZoom, 0, 0, fitZoom, panX, panY]);
        state.canvas.renderAll();
        updateZoomDisplay();
        return;
      }
    }

    state.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    state.canvas.renderAll();
    updateZoomDisplay();
  }

  // ==========================================
  // PATIENT IMAGE LOADER & SAMPLES
  // ==========================================
  function loadInitialPatientSample(sampleType = 'female_smile') {
    if (!window.DSD_SAMPLE_DATA) return;
    const dataUrl = window.DSD_SAMPLE_DATA.getSamplePortrait(sampleType);
    loadBackgroundImage(dataUrl, () => {
      // Setup initial reference lines centered on canvas
      setupReferenceOverlays();
      // Add default Upper Central Incisors for instant DSD demonstration
      addDefaultSmileDesign();
      fitDesignToViewport();
      recordHistory();
    });
  }

  function loadBackgroundImage(dataUrl, callback) {
    state.bgOriginalDataUrl = dataUrl;
    fabric.Image.fromURL(dataUrl, (img) => {
      if (!img || !state.canvas) return;

      // Remove existing background if present
      if (state.bgImage) {
        state.canvas.remove(state.bgImage);
      }

      const container = document.getElementById('canvas-viewport');
      const canvasW = container ? container.clientWidth : state.canvas.getWidth();
      const canvasH = container ? container.clientHeight : state.canvas.getHeight();
      state.canvas.setDimensions({ width: canvasW, height: canvasH });

      // Baseline scale
      const scaleX = (canvasW * 0.92) / img.width;
      const scaleY = (canvasH * 0.92) / img.height;
      const scale = Math.min(scaleX, scaleY, 1.0);

      img.set({
        left: canvasW / 2,
        top: canvasH / 2,
        originX: 'center',
        originY: 'center',
        scaleX: scale,
        scaleY: scale,
        selectable: false,
        evented: false,
        hasControls: false,
        hoverCursor: 'default',
        dsdType: 'background',
        toothName: 'Patient Clinical Photo'
      });

      state.bgImage = img;
      state.canvas.insertAt(img, 0); // Always at bottom

      // Estimate initial calibration based on typical facial portrait if uncalibrated
      if (!state.isCalibrated) {
        // Average facial portrait central incisor pixel height estimate
        const estimatedIncisorPx = img.height * scale * 0.052;
        calibrateWithValues(estimatedIncisorPx, 10.5, false);
      }

      fitDesignToViewport();
      state.canvas.renderAll();
      updateLayerManager();
      if (callback) callback();
    }, { crossOrigin: 'anonymous' });
  }

  function addDefaultSmileDesign() {
    const cx = state.canvas.getWidth() / 2;
    const cy = state.canvas.getHeight() / 2 + 105;

    // Add Upper Central Incisors #11 & #21
    const t11 = window.createToothShape('centralRight', {
      left: cx - 18,
      top: cy,
      fill: state.shades[state.activeShade].fill,
      stroke: state.shades[state.activeShade].stroke,
      opacity: state.activeOpacity
    });
    const t21 = window.createToothShape('centralLeft', {
      left: cx + 18,
      top: cy,
      fill: state.shades[state.activeShade].fill,
      stroke: state.shades[state.activeShade].stroke,
      opacity: state.activeOpacity
    });

    if (t11 && t21) {
      // Scale according to calibration
      const defaultScale = state.pixelsPerMm ? (10.5 * state.pixelsPerMm) / 115 : 0.38;
      t11.scale(defaultScale);
      t21.scale(defaultScale);
      state.canvas.add(t11);
      state.canvas.add(t21);
      state.canvas.setActiveObject(t11);
    }
  }

  // ==========================================
  // REFERENCE LINES OVERLAYS
  // ==========================================
  function setupReferenceOverlays() {
    const cx = state.canvas.getWidth() / 2;
    const cy = state.canvas.getHeight() / 2;
    const w = state.canvas.getWidth();
    const h = state.canvas.getHeight();

    // Remove existing
    Object.values(state.referenceLines).forEach(item => {
      if (item) state.canvas.remove(item);
    });

    // 1. Facial Midline (Vertical Red line)
    const midline = new fabric.Line([cx, 40, cx, h - 40], {
      stroke: '#ef4444',
      strokeWidth: 2,
      strokeDashArray: [8, 5],
      selectable: true,
      hasBorders: true,
      hasControls: true,
      cornerColor: '#ef4444',
      cornerSize: 8,
      visible: state.overlayVisibility.midline,
      dsdType: 'reference',
      toothName: 'Facial Midline (Red)'
    });
    state.referenceLines.midline = midline;
    state.canvas.add(midline);

    // 2. Interpupillary Line (Horizontal Blue line passing through eye level)
    const eyeY = cy - 120;
    const interpupillary = new fabric.Line([cx - 260, eyeY, cx + 260, eyeY], {
      stroke: '#3b82f6',
      strokeWidth: 2,
      selectable: true,
      hasBorders: true,
      hasControls: true,
      cornerColor: '#3b82f6',
      cornerSize: 8,
      visible: state.overlayVisibility.interpupillary,
      dsdType: 'reference',
      toothName: 'Interpupillary Line (Blue)'
    });
    state.referenceLines.interpupillary = interpupillary;
    state.canvas.add(interpupillary);

    // 3. Commissural Line (Horizontal Green line at lip corners)
    const mouthY = cy + 115;
    const commissural = new fabric.Line([cx - 200, mouthY, cx + 200, mouthY], {
      stroke: '#10b981',
      strokeWidth: 2,
      strokeDashArray: [6, 4],
      selectable: true,
      hasBorders: true,
      hasControls: true,
      cornerColor: '#10b981',
      cornerSize: 8,
      visible: state.overlayVisibility.commissural,
      dsdType: 'reference',
      toothName: 'Commissural Line (Green)'
    });
    state.referenceLines.commissural = commissural;
    state.canvas.add(commissural);

    // 4. Smile Arc Curve (Cyan Bezier)
    if (window.createSmileArcCurve) {
      const smileArc = window.createSmileArcCurve(280, cx, mouthY + 12);
      smileArc.visible = state.overlayVisibility.smileArc;
      state.referenceLines.smileArc = smileArc;
      state.canvas.add(smileArc);
    }

    // 5. Golden Proportion Grid (Gold Caliper)
    if (window.createGoldenProportionGrid) {
      const goldenGrid = window.createGoldenProportionGrid(cx, mouthY);
      goldenGrid.visible = state.overlayVisibility.goldenGrid;
      goldenGrid.scale(0.85);
      state.referenceLines.goldenGrid = goldenGrid;
      state.canvas.add(goldenGrid);
    }

    state.canvas.renderAll();
  }

  function toggleReferenceLine(type) {
    state.overlayVisibility[type] = !state.overlayVisibility[type];
    const lineObj = state.referenceLines[type];
    if (lineObj) {
      lineObj.set('visible', state.overlayVisibility[type]);
      state.canvas.renderAll();
      updateOverlayToggleButtons();
      updateLayerManager();
    }
  }

  function updateOverlayToggleButtons() {
    const overlayKeys = ['midline', 'interpupillary', 'commissural', 'smileArc', 'goldenGrid'];

    overlayKeys.forEach((key) => {
      const isActive = state.overlayVisibility[key];
      const desktopBtn = document.getElementById(`toggle-${key.toLowerCase()}`);
      const mobileBtn = document.getElementById(`m-toggle-${key.toLowerCase()}`);

      [desktopBtn, mobileBtn].forEach((btn) => {
        if (!btn) return;
        if (isActive) {
          btn.classList.add('bg-blue-600', 'text-white');
          btn.classList.remove('bg-slate-800', 'text-slate-300', 'hover:bg-slate-700');
        } else {
          btn.classList.remove('bg-blue-600', 'text-white');
          btn.classList.add('bg-slate-800', 'text-slate-300', 'hover:bg-slate-700');
        }
      });
    });
  }

  // ==========================================
  // TWO-CLICK CALIBRATION SYSTEM
  // ==========================================
  function startCalibration() {
    state.calibrationState = 'P1';
    state.calibrationP1 = null;
    clearCalibrationTempVisuals();

    // Switch cursor and notify user
    state.canvas.defaultCursor = 'crosshair';
    state.canvas.discardActiveObject();
    state.canvas.renderAll();

    showToast('Click Point A on canvas (e.g. Incisal Edge or Ruler 0)', 'info');
    updateCalibrationUI();
  }

  function cancelCalibration() {
    state.calibrationState = 'IDLE';
    state.calibrationP1 = null;
    clearCalibrationTempVisuals();
    state.canvas.defaultCursor = 'default';
    state.canvas.renderAll();
    updateCalibrationUI();
  }

  function clearCalibrationTempVisuals() {
    if (state.calibrationTempLine) {
      state.canvas.remove(state.calibrationTempLine);
      state.calibrationTempLine = null;
    }
    if (state.calibrationTempMarkerA) {
      state.canvas.remove(state.calibrationTempMarkerA);
      state.calibrationTempMarkerA = null;
    }
    if (state.calibrationTempMarkerB) {
      state.canvas.remove(state.calibrationTempMarkerB);
      state.calibrationTempMarkerB = null;
    }
  }

  function handleCalibrationClick(pointer) {
    if (state.calibrationState === 'P1') {
      state.calibrationP1 = { x: pointer.x, y: pointer.y };
      state.calibrationState = 'P2';

      // Draw Marker A
      state.calibrationTempMarkerA = new fabric.Circle({
        left: pointer.x,
        top: pointer.y,
        radius: 5,
        fill: '#ef4444',
        stroke: '#ffffff',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false
      });
      state.canvas.add(state.calibrationTempMarkerA);

      // Temporary connecting line
      state.calibrationTempLine = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
        stroke: '#ef4444',
        strokeWidth: 2.5,
        strokeDashArray: [4, 4],
        selectable: false,
        evented: false
      });
      state.canvas.add(state.calibrationTempLine);
      state.canvas.renderAll();

      showToast('Now click Point B (e.g. Cervical Zenith or Ruler Mark)', 'info');
      updateCalibrationUI();
    } else if (state.calibrationState === 'P2') {
      const p1 = state.calibrationP1;
      const p2 = { x: pointer.x, y: pointer.y };
      const pxDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

      if (pxDist < 5) {
        showToast('Distance too small. Please click two distinct points.', 'warning');
        return;
      }

      state.pixelDistance = pxDist;

      // Update line and marker B
      state.calibrationTempLine.set({ x2: p2.x, y2: p2.y });
      state.calibrationTempMarkerB = new fabric.Circle({
        left: pointer.x,
        top: pointer.y,
        radius: 5,
        fill: '#10b981',
        stroke: '#ffffff',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false
      });
      state.canvas.add(state.calibrationTempMarkerB);
      state.canvas.renderAll();

      // Open Modal to enter millimeters
      openCalibrationModal(pxDist);
    }
  }

  function openCalibrationModal(pxDist) {
    const modal = document.getElementById('calibration-modal');
    const pxDisplay = document.getElementById('calib-pixel-display');
    const mmInput = document.getElementById('calib-mm-input');
    if (!modal) return;

    if (pxDisplay) pxDisplay.textContent = `${pxDist.toFixed(1)} px`;
    if (mmInput) {
      mmInput.value = state.realMmDistance || 10.5;
      mmInput.focus();
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function confirmCalibration() {
    const mmInput = document.getElementById('calib-mm-input');
    const modal = document.getElementById('calibration-modal');
    const realMm = parseFloat(mmInput.value);

    if (isNaN(realMm) || realMm <= 0) {
      showToast('Please enter a valid positive millimeter measurement.', 'error');
      return;
    }

    calibrateWithValues(state.pixelDistance, realMm, true);

    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }

    clearCalibrationTempVisuals();
    state.calibrationState = 'IDLE';
    state.canvas.defaultCursor = 'default';
    state.canvas.renderAll();
    showToast(`Calibrated! 1 mm = ${state.pixelsPerMm.toFixed(2)} px`, 'success');
  }

  function calibrateWithValues(pxDistance, realMm, isUserConfirmed = true) {
    state.realMmDistance = realMm;
    state.pixelDistance = pxDistance;
    state.mmPerPixel = realMm / pxDistance;
    state.pixelsPerMm = pxDistance / realMm;
    state.isCalibrated = isUserConfirmed;

    updateCalibrationUI();
    updateDimensionInspector();
  }

  function updateCalibrationUI() {
    const statusBadge = document.getElementById('calib-status-badge');
    const ratioText = document.getElementById('calib-ratio-text');
    const calibBtn = document.getElementById('btn-start-calibration');

    if (state.calibrationState !== 'IDLE') {
      if (calibBtn) {
        calibBtn.classList.add('bg-amber-600', 'animate-pulse');
        calibBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i><span class="hidden sm:inline">Calibrating... </span><span>(Point ' + (state.calibrationState === 'P1' ? 'A' : 'B') + ')</span>';
      }
    } else {
      if (calibBtn) {
        calibBtn.classList.remove('bg-amber-600', 'animate-pulse');
        calibBtn.innerHTML = '<i class="fa-solid fa-ruler-combined mr-1.5 text-xs"></i><span class="hidden sm:inline">2-Click </span><span>Calibrate</span>';
      }
    }

    if (statusBadge && ratioText) {
      if (state.isCalibrated && state.pixelsPerMm) {
        statusBadge.className = 'text-xs font-semibold text-emerald-400 flex items-center gap-1.5';
        statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400"></span> Calibrated';
        ratioText.textContent = `1 mm = ${state.pixelsPerMm.toFixed(2)} px (${state.mmPerPixel.toFixed(4)} mm/px)`;
      } else {
        statusBadge.className = 'text-xs font-semibold text-amber-400 flex items-center gap-1.5';
        statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400"></span> Uncalibrated (Default Scale)';
        ratioText.textContent = state.pixelsPerMm ? `Est: 1 mm ≈ ${state.pixelsPerMm.toFixed(2)} px` : 'Click Calibrate to measure in mm';
      }
    }
  }

  // ==========================================
  // REAL-TIME TOOTH DIMENSION INSPECTOR
  // ==========================================
  function updateDimensionInspector() {
    const activeObj = state.canvas ? state.canvas.getActiveObject() : null;
    const nameEl = document.getElementById('inspect-name');
    const widthMmEl = document.getElementById('inspect-width-mm');
    const heightMmEl = document.getElementById('inspect-height-mm');
    const ratioEl = document.getElementById('inspect-ratio');
    const ratioBadgeEl = document.getElementById('inspect-ratio-badge');
    const angleEl = document.getElementById('inspect-angle');
    const emptyState = document.getElementById('inspect-empty');
    const dataState = document.getElementById('inspect-data');

    // Mobile Inspector Elements
    const mNameEl = document.getElementById('m-inspect-name');
    const mWidthEl = document.getElementById('m-inspect-width');
    const mHeightEl = document.getElementById('m-inspect-height');
    const mRatioEl = document.getElementById('m-inspect-ratio');

    if (!activeObj || activeObj.dsdType === 'background') {
      if (emptyState) emptyState.classList.remove('hidden');
      if (dataState) dataState.classList.add('hidden');
      if (mNameEl) mNameEl.textContent = 'Select tooth on canvas';
      if (mWidthEl) mWidthEl.textContent = '-- mm';
      if (mHeightEl) mHeightEl.textContent = '-- mm';
      if (mRatioEl) mRatioEl.textContent = '-- %';
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (dataState) dataState.classList.remove('hidden');

    const bound = activeObj.getBoundingRect();
    const mmRatio = state.mmPerPixel || 0.09; // fallback ratio

    const widthMm = bound.width * mmRatio;
    const heightMm = bound.height * mmRatio;
    const whRatio = heightMm > 0 ? (widthMm / heightMm) * 100 : 0;
    const angle = Math.round(activeObj.angle || 0) % 360;

    const toothTitle = activeObj.toothName || 'Selected Object';
    if (nameEl) nameEl.textContent = toothTitle;
    if (widthMmEl) widthMmEl.textContent = `${widthMm.toFixed(2)} mm`;
    if (heightMmEl) heightMmEl.textContent = `${heightMm.toFixed(2)} mm`;
    if (angleEl) angleEl.textContent = `${angle}°`;

    if (mNameEl) mNameEl.textContent = toothTitle;
    if (mWidthEl) mWidthEl.textContent = `${widthMm.toFixed(2)} mm`;
    if (mHeightEl) mHeightEl.textContent = `${heightMm.toFixed(2)} mm`;
    if (mRatioEl) mRatioEl.textContent = `${whRatio.toFixed(1)}%`;

    if (ratioEl && ratioBadgeEl) {
      ratioEl.textContent = `${whRatio.toFixed(1)} %`;

      // Clinical Golden Standard: Central Incisor Width/Height is ideally 75% - 85% (Optimal: 80%)
      if (whRatio >= 75 && whRatio <= 85) {
        ratioBadgeEl.className = 'text-xs px-2 py-0.5 rounded font-medium bg-emerald-950 text-emerald-300 border border-emerald-800';
        ratioBadgeEl.textContent = 'Ideal Aesthetic Ratio (75–85%)';
      } else if (whRatio < 75) {
        ratioBadgeEl.className = 'text-xs px-2 py-0.5 rounded font-medium bg-amber-950 text-amber-300 border border-amber-800';
        ratioBadgeEl.textContent = 'Narrow / Elongated (<75%)';
      } else {
        ratioBadgeEl.className = 'text-xs px-2 py-0.5 rounded font-medium bg-blue-950 text-blue-300 border border-blue-800';
        ratioBadgeEl.textContent = 'Wide / Squat (>85%)';
      }
    }

    // Sync Opacity slider with active object (Desktop & Mobile)
    const opacitySlider = document.getElementById('object-opacity-slider');
    const opacityValue = document.getElementById('object-opacity-value');
    const mOpacitySlider = document.getElementById('m-opacity-slider');
    const mOpacityValue = document.getElementById('m-opacity-value');
    if (activeObj.opacity !== undefined) {
      const pct = Math.round(activeObj.opacity * 100);
      if (opacitySlider) opacitySlider.value = pct;
      if (opacityValue) opacityValue.textContent = `${pct}%`;
      if (mOpacitySlider) mOpacitySlider.value = pct;
      if (mOpacityValue) mOpacityValue.textContent = `${pct}%`;
    }
  }

  // ==========================================
  // OBJECT MANIPULATION & VISAGISM ACTIONS (from dsd_optimized.pptx)
  // ==========================================
  function setActiveArchetype(archetypeKey) {
    if (!window.DSDToothLibrary || !window.DSDToothLibrary.ARCHETYPES[archetypeKey]) return;
    state.activeArchetype = archetypeKey;
    const arch = window.DSDToothLibrary.ARCHETYPES[archetypeKey];

    // Update Archetype Tab Buttons (both Desktop & Mobile)
    document.querySelectorAll('[data-archetype]').forEach(btn => {
      const isCurrent = btn.dataset.archetype === archetypeKey;
      if (isCurrent) {
        btn.classList.add('bg-blue-600', 'text-white', 'shadow-md', 'border-blue-500');
        btn.classList.remove('bg-slate-800', 'text-slate-300', 'border-slate-700/60');
      } else {
        btn.classList.remove('bg-blue-600', 'text-white', 'shadow-md', 'border-blue-500');
        btn.classList.add('bg-slate-800', 'text-slate-300', 'border-slate-700/60');
      }
    });

    // Update Visagism Card Content
    const titleEl = document.getElementById('visagism-title');
    const arNameEl = document.getElementById('visagism-ar-name');
    const traitsEl = document.getElementById('visagism-traits');
    const traitsArEl = document.getElementById('visagism-traits-ar');
    const clinicalEl = document.getElementById('visagism-clinical');
    const axisEl = document.getElementById('visagism-axis');

    if (titleEl) titleEl.textContent = arch.name;
    if (arNameEl) arNameEl.textContent = arch.arabicName;
    if (traitsEl) traitsEl.textContent = arch.traits;
    if (traitsArEl) traitsArEl.textContent = arch.traitsAr;
    if (clinicalEl) clinicalEl.textContent = arch.clinical;
    if (axisEl) axisEl.textContent = `${arch.facialAxis} · ${arch.smileLine}`;

    // Update Individual Tooth Button Dimensions (Desktop & Mobile)
    Object.entries(arch.teeth).forEach(([key, tDef]) => {
      document.querySelectorAll(`[data-tooth-action="${key}"]`).forEach(btn => {
        const mmSpan = btn.querySelector('.tooth-dim-span');
        if (mmSpan) {
          mmSpan.textContent = `${tDef.widthMm}mm`;
        }
      });
    });

    showToast(`Visagism Archetype: ${arch.name}`, 'info');
  }

  function addToothToCanvas(toothKey) {
    if (!window.DSDToothLibrary) return;
    const cx = state.canvas.getWidth() / 2;
    const cy = state.canvas.getHeight() / 2;

    const toothObj = window.DSDToothLibrary.createToothShape(state.activeArchetype, toothKey, {
      left: cx + (Math.random() * 30 - 15),
      top: cy + (Math.random() * 30 - 15),
      shade: state.activeShade,
      opacity: state.activeOpacity,
      pixelsPerMm: state.pixelsPerMm || 11.2
    });

    if (toothObj) {
      state.canvas.add(toothObj);
      state.canvas.setActiveObject(toothObj);
      state.canvas.renderAll();
      showToast(`Added ${toothObj.displayName}`, 'success');
      recordHistory();
    }
  }

  function addFullArchToCanvas(count = 6) {
    if (!window.DSDToothLibrary) return;
    const cx = state.canvas.getWidth() / 2;
    const cy = state.canvas.getHeight() / 2 + 100;

    const archObj = window.DSDToothLibrary.createFullSmileArch(state.activeArchetype, count, {
      left: cx,
      top: cy,
      shade: state.activeShade,
      opacity: state.activeOpacity,
      pixelsPerMm: state.pixelsPerMm || 11.2
    });

    if (archObj) {
      state.canvas.add(archObj);
      state.canvas.setActiveObject(archObj);
      state.canvas.renderAll();
      showToast(`Added ${archObj.displayName}`, 'success');
      recordHistory();
    }
  }

  function addSmileArcCurveToCanvas() {
    if (!window.DSDToothLibrary) return;
    const cx = state.canvas.getWidth() / 2;
    const cy = state.canvas.getHeight() / 2 + 125;

    const arcObj = window.DSDToothLibrary.createSmileArcCurve(state.activeArchetype, {
      left: cx,
      top: cy,
      width: (state.pixelsPerMm || 11.2) * 52
    });

    if (arcObj) {
      state.canvas.add(arcObj);
      state.canvas.setActiveObject(arcObj);
      state.canvas.renderAll();
      showToast(`Added ${arcObj.displayName}`, 'success');
      recordHistory();
    }
  }

  function addFacialAxisLinesToCanvas() {
    if (!window.DSDToothLibrary) return;
    const cx = state.canvas.getWidth() / 2;
    const cy = state.canvas.getHeight() / 2 + 100;

    const axisObj = window.DSDToothLibrary.createFacialAxisLines(state.activeArchetype, {
      left: cx,
      top: cy
    });

    if (axisObj) {
      state.canvas.add(axisObj);
      state.canvas.setActiveObject(axisObj);
      state.canvas.renderAll();
      showToast(`Added ${axisObj.displayName}`, 'success');
      recordHistory();
    }
  }

  function addCalibratedRulerToCanvas(lengthMm = 20.0, useImage = false) {
    const cx = state.canvas.getWidth() / 2;
    const cy = state.canvas.getHeight() / 2 - 140;

    if (useImage) {
      const imgPath = lengthMm === 35 ? './assets/dsd/image98.png' : './assets/dsd/image109.png';
      fabric.Image.fromURL(imgPath, (rulerImg) => {
        if (!rulerImg) return;
        const targetW = lengthMm * (state.pixelsPerMm || 11.2);
        rulerImg.scaleToWidth(targetW);
        rulerImg.set({
          left: cx,
          top: cy,
          originX: 'center',
          originY: 'center',
          cornerColor: '#38bdf8',
          borderColor: '#38bdf8',
          isDSDRuler: true,
          displayName: `PPTX ${lengthMm}mm Photographic Scale Bar`,
          dsdType: 'ruler'
        });
        state.canvas.add(rulerImg);
        state.canvas.setActiveObject(rulerImg);
        state.canvas.renderAll();
        showToast(`Added PPTX ${lengthMm}mm Scale Bar`, 'success');
        recordHistory();
      });
    } else {
      if (!window.DSDToothLibrary) return;
      const rulerObj = window.DSDToothLibrary.createCalibratedRuler(lengthMm, {
        left: cx,
        top: cy,
        pixelsPerMm: state.pixelsPerMm || 11.2
      });
      if (rulerObj) {
        state.canvas.add(rulerObj);
        state.canvas.setActiveObject(rulerObj);
        state.canvas.renderAll();
        showToast(`Added ${rulerObj.displayName}`, 'success');
        recordHistory();
      }
    }
  }

  function flipSelectedHorizontal() {
    const active = state.canvas.getActiveObject();
    if (!active || active.dsdType === 'background') return;
    active.set('flipX', !active.flipX);
    state.canvas.renderAll();
    updateDimensionInspector();
    recordHistory();
  }

  function duplicateSelected() {
    const active = state.canvas.getActiveObject();
    if (!active || active.dsdType === 'background') return;

    active.clone((cloned) => {
      state.canvas.discardActiveObject();
      cloned.set({
        left: cloned.left + 25,
        top: cloned.top + 25,
        evented: true
      });
      if (cloned.type === 'activeSelection') {
        cloned.canvas = state.canvas;
        cloned.forEachObject((obj) => state.canvas.add(obj));
        cloned.setCoords();
      } else {
        state.canvas.add(cloned);
      }
      state.canvas.setActiveObject(cloned);
      state.canvas.renderAll();
      recordHistory();
      showToast('Object duplicated', 'info');
    });
  }

  function deleteSelected() {
    const active = state.canvas.getActiveObject();
    if (!active || active.dsdType === 'background') return;

    if (active.type === 'activeSelection') {
      active.forEachObject((obj) => state.canvas.remove(obj));
      state.canvas.discardActiveObject();
    } else {
      state.canvas.remove(active);
    }
    state.canvas.renderAll();
    recordHistory();
    showToast('Object removed', 'info');
  }

  function bringSelectedForward() {
    const active = state.canvas.getActiveObject();
    if (!active) return;
    state.canvas.bringForward(active);
    state.canvas.renderAll();
    updateLayerManager();
  }

  function sendSelectedBackward() {
    const active = state.canvas.getActiveObject();
    if (!active) return;
    // Don't go below background image
    const bgIndex = state.bgImage ? state.canvas.getObjects().indexOf(state.bgImage) : -1;
    const activeIndex = state.canvas.getObjects().indexOf(active);
    if (activeIndex > bgIndex + 1) {
      state.canvas.sendBackwards(active);
      state.canvas.renderAll();
      updateLayerManager();
    }
  }

  function applyShadeToSelected(shadeKey) {
    state.activeShade = shadeKey;
    const shade = state.shades[shadeKey];
    const active = state.canvas.getActiveObject();

    if (active && active.dsdType !== 'background') {
      if (active.type === 'group') {
        active.forEachObject((sub) => {
          if (sub.type === 'path') {
            sub.set({ fill: shade.fill, stroke: shade.stroke });
          }
        });
      } else if (active.type === 'path') {
        active.set({ fill: shade.fill, stroke: shade.stroke });
      }
      state.canvas.renderAll();
      recordHistory();
    }

    // Update Shade UI pills
    document.querySelectorAll('.shade-selector-btn').forEach(btn => {
      if (btn.dataset.shade === shadeKey) {
        btn.classList.add('ring-2', 'ring-blue-500', 'border-blue-400');
      } else {
        btn.classList.remove('ring-2', 'ring-blue-500', 'border-blue-400');
      }
    });
  }

  function applyOpacityToSelected(value) {
    const opacity = parseFloat(value) / 100;
    state.activeOpacity = opacity;
    const active = state.canvas.getActiveObject();
    if (active && active.dsdType !== 'background') {
      active.set('opacity', opacity);
      state.canvas.renderAll();
    }
    const valEl = document.getElementById('object-opacity-value');
    if (valEl) valEl.textContent = `${Math.round(opacity * 100)}%`;
  }

  // ==========================================
  // LAYER MANAGER
  // ==========================================
  function updateLayerManager() {
    const container = document.getElementById('layer-list');
    if (!container || !state.canvas) return;

    const objects = [...state.canvas.getObjects()].reverse(); // top to bottom
    container.innerHTML = '';

    if (objects.length === 0) {
      container.innerHTML = '<div class="text-xs text-slate-500 text-center py-4">No layers</div>';
      return;
    }

    const activeObj = state.canvas.getActiveObject();

    objects.forEach((obj, idx) => {
      const isSelected = activeObj === obj;
      const isBg = obj.dsdType === 'background';
      const itemEl = document.createElement('div');
      itemEl.className = `flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer ${
        isSelected ? 'bg-blue-900/60 text-blue-200 border border-blue-700/50' : 'hover:bg-slate-800/80 text-slate-300'
      }`;

      // Left: Icon & Name
      const leftDiv = document.createElement('div');
      leftDiv.className = 'flex items-center gap-2 truncate';

      let iconClass = 'fa-tooth text-blue-400';
      if (isBg) iconClass = 'fa-image text-slate-400';
      else if (obj.dsdType === 'reference') iconClass = 'fa-ruler-horizontal text-emerald-400';
      else if (obj.dsdType === 'arch') iconClass = 'fa-grip text-sky-400';
      else if (obj.dsdType === 'smileArc') iconClass = 'fa-bezier-curve text-cyan-400';
      else if (obj.dsdType === 'grid') iconClass = 'fa-table-cells text-amber-400';

      leftDiv.innerHTML = `<i class="fa-solid ${iconClass} w-4 text-center"></i><span class="truncate">${obj.toothName || `Layer ${objects.length - idx}`}</span>`;

      // Right: Actions (Visibility & Lock)
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'flex items-center gap-1.5 shrink-0';

      // Visibility Toggle
      const eyeBtn = document.createElement('button');
      eyeBtn.className = 'w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200';
      eyeBtn.innerHTML = obj.visible !== false ? '<i class="fa-solid fa-eye text-[11px]"></i>' : '<i class="fa-solid fa-eye-slash text-[11px] text-slate-600"></i>';
      eyeBtn.onclick = (e) => {
        e.stopPropagation();
        obj.set('visible', !obj.visible);
        state.canvas.renderAll();
        updateLayerManager();
      };

      // Lock Toggle
      const lockBtn = document.createElement('button');
      lockBtn.className = 'w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200';
      const isLocked = !obj.selectable;
      lockBtn.innerHTML = isLocked ? '<i class="fa-solid fa-lock text-[11px] text-amber-400"></i>' : '<i class="fa-solid fa-lock-open text-[11px] text-slate-500"></i>';
      lockBtn.onclick = (e) => {
        e.stopPropagation();
        if (isBg) return; // BG always locked
        obj.set({
          selectable: isLocked,
          evented: isLocked
        });
        state.canvas.renderAll();
        updateLayerManager();
      };

      actionsDiv.appendChild(eyeBtn);
      if (!isBg) actionsDiv.appendChild(lockBtn);

      itemEl.appendChild(leftDiv);
      itemEl.appendChild(actionsDiv);

      itemEl.onclick = () => {
        if (!isBg && obj.selectable) {
          state.canvas.setActiveObject(obj);
          state.canvas.renderAll();
        }
      };

      container.appendChild(itemEl);
    });
  }

  // ==========================================
  // CANVAS EVENTS & PAN/ZOOM
  // ==========================================
  function onCanvasMouseDown(opt) {
    const evt = opt.e;

    // Calibration Mode Handler
    if (state.calibrationState !== 'IDLE') {
      const pointer = state.canvas.getPointer(evt);
      handleCalibrationClick(pointer);
      return;
    }

    // Pan with spacebar or middle mouse or pan tool
    if (state.activeTool === 'pan' || evt.spaceKey || evt.button === 1) {
      state.isPanning = true;
      state.canvas.selection = false;
      state.lastPanX = evt.clientX;
      state.lastPanY = evt.clientY;
      state.canvas.defaultCursor = 'grab';
    }
  }

  function onCanvasMouseMove(opt) {
    const evt = opt.e;

    // Live Calibration line drawing
    if (state.calibrationState === 'P2' && state.calibrationTempLine && state.calibrationP1) {
      const pointer = state.canvas.getPointer(evt);
      state.calibrationTempLine.set({ x2: pointer.x, y2: pointer.y });
      state.canvas.renderAll();
      return;
    }

    // Panning
    if (state.isPanning) {
      const deltaX = evt.clientX - state.lastPanX;
      const deltaY = evt.clientY - state.lastPanY;
      state.lastPanX = evt.clientX;
      state.lastPanY = evt.clientY;
      state.canvas.relativePan(new fabric.Point(deltaX, deltaY));
      state.canvas.defaultCursor = 'grabbing';
    }
  }

  function onCanvasMouseUp() {
    if (state.isPanning) {
      state.isPanning = false;
      state.canvas.selection = true;
      state.canvas.defaultCursor = state.activeTool === 'pan' ? 'grab' : 'default';
    }
  }

  function onCanvasMouseWheel(opt) {
    const evt = opt.e;
    evt.preventDefault();
    evt.stopPropagation();

    const delta = evt.deltaY;
    let zoom = state.canvas.getZoom();
    zoom *= 0.999 ** delta;
    if (zoom > 5.0) zoom = 5.0;
    if (zoom < 0.3) zoom = 0.3;

    state.canvas.zoomToPoint(new fabric.Point(opt.e.offsetX, opt.e.offsetY), zoom);
    updateZoomDisplay();
  }

  function resetZoom() {
    fitDesignToViewport();
  }

  function zoomIn() {
    let zoom = state.canvas.getZoom() * 1.25;
    if (zoom > 5.0) zoom = 5.0;
    const center = state.canvas.getCenter();
    state.canvas.zoomToPoint(new fabric.Point(center.left, center.top), zoom);
    updateZoomDisplay();
  }

  function zoomOut() {
    let zoom = state.canvas.getZoom() / 1.25;
    if (zoom < 0.3) zoom = 0.3;
    const center = state.canvas.getCenter();
    state.canvas.zoomToPoint(new fabric.Point(center.left, center.top), zoom);
    updateZoomDisplay();
  }

  function updateZoomDisplay() {
    const zoomEl = document.getElementById('zoom-percentage');
    if (zoomEl && state.canvas) {
      zoomEl.textContent = `${Math.round(state.canvas.getZoom() * 100)}%`;
    }
  }

  function onObjectSelected() {
    updateDimensionInspector();
    updateLayerManager();
    showFloatingControls();
  }

  function onSelectionCleared() {
    updateDimensionInspector();
    updateLayerManager();
    hideFloatingControls();
  }

  function onObjectModified() {
    updateDimensionInspector();
    recordHistory();
  }

  function showFloatingControls() {
    const toolbar = document.getElementById('floating-object-bar');
    if (toolbar) toolbar.classList.remove('hidden');
  }

  function hideFloatingControls() {
    const toolbar = document.getElementById('floating-object-bar');
    if (toolbar) toolbar.classList.add('hidden');
  }

  // ==========================================
  // UNDO / REDO HISTORY
  // ==========================================
  function recordHistory() {
    if (state.isHistoryProcessing || !state.canvas) return;

    // Prune forward history if we branched
    if (state.historyIndex < state.history.length - 1) {
      state.history = state.history.slice(0, state.historyIndex + 1);
    }

    const json = JSON.stringify(state.canvas.toJSON(['dsdType', 'toothKey', 'toothCode', 'toothName', 'selectable', 'evented']));
    state.history.push(json);

    if (state.history.length > state.maxHistory) {
      state.history.shift();
    } else {
      state.historyIndex++;
    }

    updateUndoRedoUI();
  }

  function undo() {
    if (state.historyIndex > 0) {
      state.isHistoryProcessing = true;
      state.historyIndex--;
      const json = state.history[state.historyIndex];
      state.canvas.loadFromJSON(json, () => {
        state.canvas.renderAll();
        state.isHistoryProcessing = false;
        updateUndoRedoUI();
        updateDimensionInspector();
        updateLayerManager();
      });
    }
  }

  function redo() {
    if (state.historyIndex < state.history.length - 1) {
      state.isHistoryProcessing = true;
      state.historyIndex++;
      const json = state.history[state.historyIndex];
      state.canvas.loadFromJSON(json, () => {
        state.canvas.renderAll();
        state.isHistoryProcessing = false;
        updateUndoRedoUI();
        updateDimensionInspector();
        updateLayerManager();
      });
    }
  }

  function updateUndoRedoUI() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');

    if (undoBtn) undoBtn.disabled = state.historyIndex <= 0;
    if (redoBtn) redoBtn.disabled = state.historyIndex >= state.history.length - 1;
  }

  // ==========================================
  // MULTI-FORMAT EXPORT ENGINE
  // ==========================================
  
  /**
   * Export High-DPI JPG (2x retina resolution)
   */
  function exportHighDpiJpg(includeReferenceLines = false) {
    if (!state.canvas) return;

    // Temporarily hide reference lines if requested
    const tempStates = {};
    if (!includeReferenceLines) {
      Object.entries(state.referenceLines).forEach(([key, obj]) => {
        if (obj) {
          tempStates[key] = obj.visible;
          obj.set('visible', false);
        }
      });
    }

    state.canvas.discardActiveObject();
    state.canvas.renderAll();

    try {
      const dataUrl = state.canvas.toDataURL({
        format: 'jpeg',
        quality: 0.95,
        multiplier: 2
      });

      const fileName = `${sanitizeFileName(state.patientName)}_DSD_Design_${state.caseId}.jpg`;
      downloadFile(dataUrl, fileName);
      showToast('Exported High-DPI JPG successfully', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to export JPG', 'error');
    } finally {
      // Restore line visibility
      if (!includeReferenceLines) {
        Object.entries(state.referenceLines).forEach(([key, obj]) => {
          if (obj && tempStates[key] !== undefined) {
            obj.set('visible', tempStates[key]);
          }
        });
        state.canvas.renderAll();
      }
    }
  }

  /**
   * Export PowerPoint (.pptx) via PptxGenJS v3.12.0
   * Creates clinical presentation: Cover, Before/After Simulation, Dimension Analysis Table
   */
  function exportPowerPoint() {
    if (typeof PptxGenJS === 'undefined') {
      showToast('PptxGenJS library is not loaded. Check internet connection.', 'error');
      return;
    }

    showToast('Generating 16:9 DSD Presentation...', 'info');

    // Deselect and render high-res DSD snapshot
    state.canvas.discardActiveObject();
    state.canvas.renderAll();
    const afterDsdImg = state.canvas.toDataURL({ format: 'jpeg', quality: 0.92, multiplier: 1.5 });
    const beforeImg = state.bgOriginalDataUrl || afterDsdImg;

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9'; // 10" x 5.625"

    // SLIDE 1: Cover Slide
    const slide1 = pptx.addSlide();
    slide1.background = { color: '0f172a' }; // Slate 900

    // Header Accent Line
    slide1.addShape(pptx.shapes.RECTANGLE, {
      x: 0.8, y: 1.0, w: 0.15, h: 2.2,
      fill: { color: '2563eb' }
    });

    slide1.addText('DIGITAL SMILE DESIGN (DSD)', {
      x: 1.1, y: 1.0, w: 8.5, h: 0.8,
      fontSize: 28, bold: true, color: 'ffffff', fontFace: 'Helvetica'
    });
    slide1.addText('2D Clinical Aesthetic Simulation & Biometric Evaluation Report', {
      x: 1.1, y: 1.7, w: 8.5, h: 0.4,
      fontSize: 14, color: '94a3b8', fontFace: 'Helvetica'
    });

    // Patient Specification Card
    slide1.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 1.1, y: 2.5, w: 7.8, h: 2.2,
      fill: { color: '1e293b' },
      line: { color: '334155', width: 1 }
    });

    const metaDataRows = [
      `Patient Name:     ${state.patientName}`,
      `Clinical Case ID: ${state.caseId}`,
      `Date of Design:   ${state.date}`,
      `Attending Doctor: ${state.clinicianName}`,
      `Institution:      ${state.clinicName}`,
      `Scale Factor:     ${state.isCalibrated ? `1 mm = ${state.pixelsPerMm.toFixed(2)} px` : 'Default Uncalibrated'}`
    ];

    slide1.addText(metaDataRows.join('\n'), {
      x: 1.4, y: 2.7, w: 7.2, h: 1.8,
      fontSize: 12, color: 'e2e8f0', fontFace: 'Helvetica', lineSpacing: 22
    });

    // SLIDE 2: Side-by-Side Comparison (Pre-Op vs Post-Op DSD)
    const slide2 = pptx.addSlide();
    slide2.background = { color: '0f172a' };

    slide2.addText('CLINICAL SMILE DESIGN COMPARISON', {
      x: 0.8, y: 0.4, w: 8.5, h: 0.5,
      fontSize: 20, bold: true, color: 'ffffff', fontFace: 'Helvetica'
    });

    // Left: Baseline / Before
    slide2.addShape(pptx.shapes.RECTANGLE, {
      x: 0.8, y: 1.0, w: 4.0, h: 3.4,
      fill: { color: '020617' },
      line: { color: '475569', width: 1 }
    });
    slide2.addImage({ data: beforeImg, x: 0.85, y: 1.05, w: 3.9, h: 3.3 });
    slide2.addText('PRE-OPERATIVE BASELINE', {
      x: 0.8, y: 4.5, w: 4.0, h: 0.35,
      fontSize: 11, bold: true, color: '94a3b8', align: 'center'
    });

    // Right: DSD Simulation / After
    slide2.addShape(pptx.shapes.RECTANGLE, {
      x: 5.2, y: 1.0, w: 4.0, h: 3.4,
      fill: { color: '020617' },
      line: { color: '2563eb', width: 1.5 }
    });
    slide2.addImage({ data: afterDsdImg, x: 5.25, y: 1.05, w: 3.9, h: 3.3 });
    slide2.addText('PROPOSED DSD 2D AESTHETIC DESIGN', {
      x: 5.2, y: 4.5, w: 4.0, h: 0.35,
      fontSize: 11, bold: true, color: '38bdf8', align: 'center'
    });

    // Bottom Summary Banner
    slide2.addText('Maxillary anterior aesthetic alignment achieved · Golden proportion harmony verified', {
      x: 0.8, y: 4.95, w: 8.4, h: 0.3,
      fontSize: 10, italic: true, color: 'cbd5e1', align: 'center'
    });

    // SLIDE 3: Biometric Dimensions & Treatment Specifications
    const slide3 = pptx.addSlide();
    slide3.background = { color: '0f172a' };

    slide3.addText('TOOTH DIMENSION SPECIFICATIONS & AESTHETIC METRICS', {
      x: 0.8, y: 0.4, w: 8.5, h: 0.5,
      fontSize: 18, bold: true, color: 'ffffff', fontFace: 'Helvetica'
    });

    // Gather tooth dimensions
    const ratioVal = state.mmPerPixel || 0.09;
    const tableRows = [
      [
        { text: 'Tooth / Element', options: { bold: true, fill: '1e293b', color: '38bdf8' } },
        { text: 'FDI Code', options: { bold: true, fill: '1e293b', color: '38bdf8' } },
        { text: 'Design Width (mm)', options: { bold: true, fill: '1e293b', color: '38bdf8' } },
        { text: 'Design Height (mm)', options: { bold: true, fill: '1e293b', color: '38bdf8' } },
        { text: 'W/H Ratio (%)', options: { bold: true, fill: '1e293b', color: '38bdf8' } },
        { text: 'Clinical Evaluation', options: { bold: true, fill: '1e293b', color: '38bdf8' } }
      ]
    ];

    const teethObjects = state.canvas.getObjects().filter(o => o.dsdType === 'tooth');
    if (teethObjects.length > 0) {
      teethObjects.forEach(t => {
        const b = t.getBoundingRect();
        const wMm = (b.width * ratioVal).toFixed(2);
        const hMm = (b.height * ratioVal).toFixed(2);
        const r = ((b.width / b.height) * 100).toFixed(1);
        const evalText = (r >= 75 && r <= 85) ? 'Ideal (75-85%)' : (r < 75 ? 'Elongated' : 'Wide');
        tableRows.push([
          { text: t.toothName || 'Maxillary Tooth', options: { color: 'ffffff' } },
          { text: t.toothCode || 'N/A', options: { color: 'cbd5e1' } },
          { text: `${wMm} mm`, options: { color: 'cbd5e1' } },
          { text: `${hMm} mm`, options: { color: 'cbd5e1' } },
          { text: `${r}%`, options: { color: 'cbd5e1' } },
          { text: evalText, options: { color: (r >= 75 && r <= 85) ? '34d399' : 'fbbf24' } }
        ]);
      });
    } else {
      tableRows.push([
        { text: 'Upper Right Central (#11)', options: { color: 'ffffff' } },
        { text: '11', options: { color: 'cbd5e1' } },
        { text: '8.50 mm', options: { color: 'cbd5e1' } },
        { text: '10.50 mm', options: { color: 'cbd5e1' } },
        { text: '80.9%', options: { color: 'cbd5e1' } },
        { text: 'Ideal Aesthetic Target', options: { color: '34d399' } }
      ]);
      tableRows.push([
        { text: 'Upper Left Central (#21)', options: { color: 'ffffff' } },
        { text: '21', options: { color: 'cbd5e1' } },
        { text: '8.50 mm', options: { color: 'cbd5e1' } },
        { text: '10.50 mm', options: { color: 'cbd5e1' } },
        { text: '80.9%', options: { color: 'cbd5e1' } },
        { text: 'Ideal Aesthetic Target', options: { color: '34d399' } }
      ]);
    }

    slide3.addTable(tableRows, {
      x: 0.8, y: 1.1, w: 8.4,
      rowH: 0.35,
      border: { pt: 0.5, color: '334155' },
      fill: { color: '0f172a' },
      fontSize: 10
    });

    slide3.addText('Recommended Clinical Procedures: Veneers / Aesthetic Bonding / Gingivectomy for gingival zenith symmetry.', {
      x: 0.8, y: 4.8, w: 8.4, h: 0.4,
      fontSize: 11, italic: true, color: '38bdf8'
    });

    // SLIDE 4: Visagism Morpho-psychology & Aesthetic Harmony (from dsd_optimized.pptx Slide 7)
    const slide4 = pptx.addSlide();
    slide4.background = { color: '0f172a' };

    slide4.addText('VISAGISM MORPHO-PSYCHOLOGY & HARMONY ANALYSIS', {
      x: 0.8, y: 0.4, w: 8.5, h: 0.5,
      fontSize: 18, bold: true, color: 'ffffff', fontFace: 'Helvetica'
    });

    const activeArch = (window.DSDToothLibrary && window.DSDToothLibrary.ARCHETYPES[state.activeArchetype]) || {
      name: 'Oval (Melancholic)',
      arabicName: 'البيضاوي (الحساس المنظم)',
      traits: 'Sensitive, Organized, Perfectionist, Artistic, Timid, Reserved',
      clinical: 'Dominant Centrals, Rounded cusps, Delicate laterals, Round Arch',
      facialAxis: 'Curved / Harmonious',
      smileLine: 'Round Harmonious Smile Arc'
    };

    // Active Archetype Highlight Box
    slide4.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.8, y: 1.0, w: 8.4, h: 1.4,
      fill: { color: '1e293b' },
      line: { color: '2563eb', width: 1.5 }
    });

    slide4.addText(`Selected Archetype: ${activeArch.name} · ${activeArch.arabicName}`, {
      x: 1.0, y: 1.1, w: 8.0, h: 0.35,
      fontSize: 14, bold: true, color: '38bdf8'
    });
    slide4.addText(`Psychological Profile: ${activeArch.traits}`, {
      x: 1.0, y: 1.45, w: 8.0, h: 0.35,
      fontSize: 11, color: 'e2e8f0'
    });
    slide4.addText(`Clinical Dental Anatomy: ${activeArch.clinical} | Axis: ${activeArch.facialAxis} | Smile Line: ${activeArch.smileLine}`, {
      x: 1.0, y: 1.8, w: 8.0, h: 0.45,
      fontSize: 10, italic: true, color: '94a3b8'
    });

    // 4 Archetypes Comparative Matrix (Slide 7 representation)
    const matrixRows = [
      [
        { text: 'Archetype', options: { bold: true, fill: '1e293b', color: '38bdf8' } },
        { text: 'Expression / Traits', options: { bold: true, fill: '1e293b', color: '38bdf8' } },
        { text: 'Dental Arch & Shapes', options: { bold: true, fill: '1e293b', color: '38bdf8' } },
        { text: 'Axial Inclination', options: { bold: true, fill: '1e293b', color: '38bdf8' } }
      ],
      [
        { text: 'Oval (Melancholic)', options: { bold: true, color: 'ffffff' } },
        { text: 'Sensible, Organized, Artistic, Perfectionist', options: { color: 'cbd5e1' } },
        { text: 'Rounded cusps, delicate laterals, dominant centrals', options: { color: 'cbd5e1' } },
        { text: 'Harmonious curved axis', options: { color: 'cbd5e1' } }
      ],
      [
        { text: 'Triangular (Sanguine)', options: { bold: true, color: 'ffffff' } },
        { text: 'Dynamic, Extroverted, Communicative, Enthusiastic', options: { color: 'cbd5e1' } },
        { text: 'Inclined cusps, dynamic ascendant smile line', options: { color: 'cbd5e1' } },
        { text: 'Converging axis', options: { color: 'cbd5e1' } }
      ],
      [
        { text: 'Rectangular (Choleric)', options: { bold: true, color: 'ffffff' } },
        { text: 'Strong, Determined, Objective, Explosive, Passionate', options: { color: 'cbd5e1' } },
        { text: 'Flat incisal edge, aggressive cusps, horizontal line', options: { color: 'cbd5e1' } },
        { text: 'Vertical / parallel axis', options: { color: 'cbd5e1' } }
      ],
      [
        { text: 'Square (Phlegmatic)', options: { bold: true, color: 'ffffff' } },
        { text: 'Calm, Diplomatic, Pacific, Mystic, Balanced', options: { color: 'cbd5e1' } },
        { text: 'Horizontal arrangement, lack of dominance', options: { color: 'cbd5e1' } },
        { text: 'Diverging axis', options: { color: 'cbd5e1' } }
      ]
    ];

    slide4.addTable(matrixRows, {
      x: 0.8, y: 2.6, w: 8.4,
      rowH: 0.38,
      border: { pt: 0.5, color: '334155' },
      fill: { color: '0f172a' },
      fontSize: 9.5
    });

    const fileName = `${sanitizeFileName(state.patientName)}_DSD_Presentation_${state.caseId}.pptx`;
    pptx.writeFile({ fileName: fileName })
      .then(() => showToast('PowerPoint (.pptx) presentation exported!', 'success'))
      .catch((err) => {
        console.error(err);
        showToast('Error exporting PowerPoint', 'error');
      });
  }

  /**
   * Export A4 Landscape PDF Report via jsPDF v2.5.1
   */
  function exportPdfReport() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      showToast('jsPDF library is not loaded. Check internet connection.', 'error');
      return;
    }

    showToast('Compiling A4 Clinical PDF Report...', 'info');

    // Deselect objects for clean snapshot
    state.canvas.discardActiveObject();
    state.canvas.renderAll();
    const dsdImage = state.canvas.toDataURL({ format: 'jpeg', quality: 0.95, multiplier: 2 });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4' // 297mm x 210mm
    });

    const pageW = 297;
    const pageH = 210;

    // Header Dark Banner
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, pageW, 26, 'F');

    // Brand & Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('DENTISCAN DIGITAL SMILE DESIGN (DSD) REPORT', 14, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text('Biometric Facial Esthetics & Tooth Proportion Analysis · 2D Simulation Protocol', 14, 18);

    doc.setTextColor(56, 189, 248); // Sky 400
    doc.text(`CONFIDENTIAL MEDICAL RECORD`, pageW - 14, 12, { align: 'right' });
    doc.setTextColor(203, 213, 225);
    doc.text(`Date: ${state.date}`, pageW - 14, 18, { align: 'right' });

    // Patient Information Grid Box
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.roundedRect(14, 30, pageW - 28, 22, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.text('PATIENT:', 18, 38);
    doc.text('CASE ID:', 85, 38);
    doc.text('CLINICIAN:', 145, 38);
    doc.text('CALIBRATION:', 215, 38);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(state.patientName, 36, 38);
    doc.text(state.caseId, 103, 38);
    doc.text(state.clinicianName, 168, 38);
    doc.text(state.isCalibrated ? `${state.pixelsPerMm.toFixed(2)} px/mm` : 'Estimated (Uncalibrated)', 242, 38);

    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.text('CLINIC:', 18, 46);
    doc.text('TECHNIQUE:', 85, 46);
    doc.text('STATUS:', 145, 46);
    doc.text('SHADE PRESET:', 215, 46);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(state.clinicName, 36, 46);
    doc.text('2D Facial Calibrated DSD', 108, 46);
    doc.text('Plan Approved', 162, 46);
    doc.text(state.shades[state.activeShade].label, 245, 46);

    // Main Canvas DSD Image (Center Left)
    const imgX = 14;
    const imgY = 56;
    const imgW = 180;
    const imgH = 118;

    doc.setDrawColor(203, 213, 225);
    doc.rect(imgX - 0.5, imgY - 0.5, imgW + 1, imgH + 1, 'S');
    doc.addImage(dsdImage, 'JPEG', imgX, imgY, imgW, imgH);

    // Right Side: Biometric Specifications & Golden Proportion Specs
    const tableX = 200;
    const tableY = 56;
    const tableW = pageW - 14 - tableX;

    doc.setFillColor(241, 245, 249);
    doc.rect(tableX, tableY, tableW, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('BIOMETRIC MEASUREMENTS (MM)', tableX + 3, tableY + 5.5);

    // Table Content
    const ratioVal = state.mmPerPixel || 0.09;
    let currY = tableY + 14;

    const teethObjects = state.canvas.getObjects().filter(o => o.dsdType === 'tooth');
    const displayTeeth = teethObjects.length > 0 ? teethObjects.slice(0, 6) : [
      { toothName: 'Central (#11)', width: 8.5, height: 10.5 },
      { toothName: 'Central (#21)', width: 8.5, height: 10.5 }
    ];

    displayTeeth.forEach((t) => {
      let wMm, hMm, r;
      if (t.getBoundingRect) {
        const b = t.getBoundingRect();
        wMm = (b.width * ratioVal).toFixed(1);
        hMm = (b.height * ratioVal).toFixed(1);
        r = ((b.width / b.height) * 100).toFixed(0);
      } else {
        wMm = t.width.toFixed(1);
        hMm = t.height.toFixed(1);
        r = ((t.width / t.height) * 100).toFixed(0);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(`${t.toothName || 'Tooth'}:`, tableX + 3, currY);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(`${wMm} × ${hMm} mm`, tableX + 42, currY);

      doc.setTextColor(2, 132, 199);
      doc.text(`W/H: ${r}%`, tableX + 66, currY);

      currY += 6.5;
    });

    // Clinical Esthetic Criteria Checklist
    currY += 2;
    doc.setFillColor(241, 245, 249);
    doc.rect(tableX, currY, tableW, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('ESTHETIC CRITERIA CHECKLIST', tableX + 3, currY + 5.5);

    currY += 12;
    const checklist = [
      'Facial Midline Concordance: Aligned with philtrum',
      'Incisal Plane: Parallel to interpupillary line',
      'Smile Arc: Convex, parallel to lower lip',
      'Central W/H Ratio: 78 - 82% (Ideal range)',
      'Gingival Margins: Canines match central zeniths'
    ];

    checklist.forEach(item => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`[✓] ${item}`, tableX + 3, currY);
      currY += 5;
    });

    // Signatures / Footer
    const footY = 190;
    doc.setDrawColor(203, 213, 225);
    doc.line(14, footY, pageW - 14, footY);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Clinician Signature: ___________________________', 14, footY + 8);
    doc.text('Patient Approval Signature: ___________________________', 110, footY + 8);
    doc.text('Dentiscan DSD Studio v2.4 · All rights reserved', pageW - 14, footY + 8, { align: 'right' });

    const fileName = `${sanitizeFileName(state.patientName)}_DSD_Report_${state.caseId}.pdf`;
    doc.save(fileName);
    showToast('Clinical PDF Report exported!', 'success');
  }

  // ==========================================
  // EVENT LISTENERS & UI WIRING
  // ==========================================
  function setupEventListeners() {
    // Patient Metadata Inputs
    const patientInput = document.getElementById('patient-name-input');
    if (patientInput) {
      patientInput.addEventListener('input', (e) => {
        state.patientName = e.target.value.trim() || 'Patient';
      });
    }

    const caseIdInput = document.getElementById('case-id-input');
    if (caseIdInput) {
      caseIdInput.addEventListener('input', (e) => {
        state.caseId = e.target.value.trim() || 'DSD-001';
      });
    }

    // Calibration Buttons
    const startCalibBtn = document.getElementById('btn-start-calibration');
    if (startCalibBtn) {
      startCalibBtn.addEventListener('click', () => {
        if (state.calibrationState === 'IDLE') {
          startCalibration();
        } else {
          cancelCalibration();
        }
      });
    }

    const calibConfirmBtn = document.getElementById('btn-confirm-calib');
    if (calibConfirmBtn) {
      calibConfirmBtn.addEventListener('click', confirmCalibration);
    }

    const calibCancelBtn = document.getElementById('btn-cancel-calib');
    if (calibCancelBtn) {
      calibCancelBtn.addEventListener('click', cancelCalibration);
    }

    // Quick Calibration Presets in Modal
    document.querySelectorAll('.calib-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const val = e.currentTarget.dataset.value;
        const mmInput = document.getElementById('calib-mm-input');
        if (mmInput && val) mmInput.value = val;
      });
    });

    // Reference Overlays Toggles
    const toggleMidlineBtn = document.getElementById('toggle-midline');
    if (toggleMidlineBtn) toggleMidlineBtn.onclick = () => toggleReferenceLine('midline');

    const toggleInterpupBtn = document.getElementById('toggle-interpupillary');
    if (toggleInterpupBtn) toggleInterpupBtn.onclick = () => toggleReferenceLine('interpupillary');

    const toggleCommissuralBtn = document.getElementById('toggle-commissural');
    if (toggleCommissuralBtn) toggleCommissuralBtn.onclick = () => toggleReferenceLine('commissural');

    const toggleSmileArcBtn = document.getElementById('toggle-smilearc');
    if (toggleSmileArcBtn) toggleSmileArcBtn.onclick = () => toggleReferenceLine('smileArc');

    const toggleGoldenGridBtn = document.getElementById('toggle-goldengrid');
    if (toggleGoldenGridBtn) toggleGoldenGridBtn.onclick = () => toggleReferenceLine('goldenGrid');

    // Visagism Archetype Switcher Tabs
    document.querySelectorAll('[data-archetype]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const archKey = e.currentTarget.dataset.archetype;
        if (archKey) setActiveArchetype(archKey);
      });
    });

    // Tooth Library Drawer Buttons (Authentic 32-tooth geometry)
    document.querySelectorAll('[data-tooth-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.toothAction;
        if (action === 'arch6') {
          addFullArchToCanvas(6);
        } else if (action === 'arch8') {
          addFullArchToCanvas(8);
        } else {
          addToothToCanvas(action);
        }
      });
    });

    // PPTX Clinical Tools & Overlays (from dsd_optimized.pptx)
    document.querySelectorAll('[data-pptx-tool]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tool = e.currentTarget.dataset.pptxTool;
        if (tool === 'smileArc') {
          addSmileArcCurveToCanvas();
        } else if (tool === 'facialAxis') {
          addFacialAxisLinesToCanvas();
        } else if (tool === 'ruler20') {
          addCalibratedRulerToCanvas(20.0, false);
        } else if (tool === 'ruler35') {
          addCalibratedRulerToCanvas(35.0, false);
        } else if (tool === 'ruler20_img') {
          addCalibratedRulerToCanvas(20.0, true);
        } else if (tool === 'ruler35_img') {
          addCalibratedRulerToCanvas(35.0, true);
        }
      });
    });

    // Shade Selection Buttons
    document.querySelectorAll('.shade-selector-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const shade = e.currentTarget.dataset.shade;
        if (shade) applyShadeToSelected(shade);
      });
    });

    // Opacity Slider
    const opacitySlider = document.getElementById('object-opacity-slider');
    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        applyOpacityToSelected(e.target.value);
      });
    }

    // Quick Actions
    const flipBtn = document.getElementById('btn-flip-h');
    if (flipBtn) flipBtn.onclick = flipSelectedHorizontal;

    const dupBtn = document.getElementById('btn-duplicate');
    if (dupBtn) dupBtn.onclick = duplicateSelected;

    const delBtn = document.getElementById('btn-delete');
    if (delBtn) delBtn.onclick = deleteSelected;

    const bringFwdBtn = document.getElementById('btn-bring-fwd');
    if (bringFwdBtn) bringFwdBtn.onclick = bringSelectedForward;

    const sendBwdBtn = document.getElementById('btn-send-bwd');
    if (sendBwdBtn) sendBwdBtn.onclick = sendSelectedBackward;

    // Undo / Redo
    const undoBtn = document.getElementById('btn-undo');
    if (undoBtn) undoBtn.onclick = undo;

    const redoBtn = document.getElementById('btn-redo');
    if (redoBtn) redoBtn.onclick = redo;

    // Header Copilot button
    const headerCopilotBtn = document.getElementById('btn-header-copilot');
    if (headerCopilotBtn) {
      headerCopilotBtn.onclick = () => {
        if (window.dsdCopilot && window.dsdCopilot.toggle) {
          window.dsdCopilot.toggle();
        }
      };
    }

    // Zoom Controls
    const zoomInBtn = document.getElementById('btn-zoom-in');
    if (zoomInBtn) zoomInBtn.onclick = zoomIn;

    const zoomOutBtn = document.getElementById('btn-zoom-out');
    if (zoomOutBtn) zoomOutBtn.onclick = zoomOut;

    const zoomResetBtn = document.getElementById('btn-zoom-reset');
    if (zoomResetBtn) zoomResetBtn.onclick = resetZoom;

    // Tool toggle (Select vs Pan)
    const toolSelectBtn = document.getElementById('tool-select');
    const toolPanBtn = document.getElementById('tool-pan');
    if (toolSelectBtn && toolPanBtn) {
      toolSelectBtn.onclick = () => {
        state.activeTool = 'select';
        state.canvas.defaultCursor = 'default';
        toolSelectBtn.classList.add('bg-blue-600', 'text-white');
        toolPanBtn.classList.remove('bg-blue-600', 'text-white');
      };
      toolPanBtn.onclick = () => {
        state.activeTool = 'pan';
        state.canvas.defaultCursor = 'grab';
        toolPanBtn.classList.add('bg-blue-600', 'text-white');
        toolSelectBtn.classList.remove('bg-blue-600', 'text-white');
      };
    }

    // Export Dropdown & Handlers
    const exportJpgBtn = document.getElementById('export-jpg');
    if (exportJpgBtn) exportJpgBtn.onclick = () => exportHighDpiJpg(false);

    const exportPptxBtn = document.getElementById('export-pptx');
    if (exportPptxBtn) exportPptxBtn.onclick = exportPowerPoint;

    const exportPdfBtn = document.getElementById('export-pdf');
    if (exportPdfBtn) exportPdfBtn.onclick = exportPdfReport;

    // Sample Patient Presets
    document.querySelectorAll('[data-sample-patient]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sampleKey = e.currentTarget.dataset.samplePatient;
        if (sampleKey) {
          loadInitialPatientSample(sampleKey);
          showToast(`Loaded ${e.currentTarget.textContent.trim()}`, 'info');
        }
      });
    });

    // Universal File Upload Handler (Patient Photo - JPG, PNG, WebP, HEIC)
    const fileInput = document.getElementById('patient-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          processPatientImageFile(file);
        }
      });
    }

    // Drag and drop photo onto canvas
    const canvasWrap = document.getElementById('canvas-viewport');
    if (canvasWrap) {
      canvasWrap.addEventListener('dragover', (e) => {
        e.preventDefault();
        canvasWrap.classList.add('border-blue-500');
      });
      canvasWrap.addEventListener('dragleave', () => {
        canvasWrap.classList.remove('border-blue-500');
      });
      canvasWrap.addEventListener('drop', (e) => {
        e.preventDefault();
        canvasWrap.classList.remove('border-blue-500');
        const file = e.dataTransfer.files[0];
        if (file) {
          processPatientImageFile(file);
        }
      });
    }
  }

  // ==========================================
  // CLIENT-SIDE IMAGE ENGINE (HEIC + DOWNSCALE)
  // ==========================================
  function isHeicFile(file) {
    if (!file) return false;
    const name = (file.name || '').toLowerCase();
    const type = (file.type || '').toLowerCase();
    return name.endsWith('.heic') || name.endsWith('.heif') || type.includes('heic') || type.includes('heif');
  }

  function downscaleImageIfNeeded(blobOrFile, maxDim = 2560) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blobOrFile);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (w <= maxDim && h <= maxDim) {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(blobOrFile);
          return;
        }
        const scale = Math.min(maxDim / w, maxDim / h);
        const targetW = Math.round(w * scale);
        const targetH = Math.round(h * scale);
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Invalid or unreadable image file'));
      };
      img.src = url;
    });
  }

  async function processPatientImageFile(file) {
    if (!file) return;
    showToast('Processing patient image...', 'info');
    try {
      let blob = file;
      if (isHeicFile(file)) {
        showToast('Converting iPhone HEIC client-side...', 'info');
        if (typeof window.heic2any === 'function') {
          const converted = await window.heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.92
          });
          blob = Array.isArray(converted) ? converted[0] : converted;
        } else {
          console.warn('heic2any not found, attempting direct load');
        }
      }

      const safeDataUrl = await downscaleImageIfNeeded(blob, 2560);
      loadBackgroundImage(safeDataUrl, () => {
        showToast('Patient photo loaded successfully', 'success');
        recordHistory();
      });
    } catch (err) {
      console.error('Error loading patient image:', err);
      showToast('Error loading image: ' + (err.message || 'Unsupported format'), 'error');
    }
  }

  // ==========================================
  // MOBILE TOUCH GESTURES (PINCH ZOOM & PAN)
  // ==========================================
  function setupTouchGestures() {
    const container = document.getElementById('canvas-viewport');
    if (!container) return;

    let initialDist = 0;
    let initialZoom = 1;
    let initialMidX = 0;
    let initialMidY = 0;
    let isPinching = false;

    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2 && state.canvas) {
        isPinching = true;
        state.canvas.discardActiveObject();
        state.canvas.renderAll();

        const t1 = e.touches[0];
        const t2 = e.touches[1];
        initialDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        initialZoom = state.canvas.getZoom();
        initialMidX = (t1.clientX + t2.clientX) / 2;
        initialMidY = (t1.clientY + t2.clientY) / 2;
        e.preventDefault();
      }
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
      if (isPinching && e.touches.length === 2 && state.canvas) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;

        if (initialDist > 10) {
          const scale = dist / initialDist;
          let newZoom = initialZoom * scale;
          if (newZoom < 0.3) newZoom = 0.3;
          if (newZoom > 5.0) newZoom = 5.0;

          const rect = container.getBoundingClientRect();
          const point = new fabric.Point(midX - rect.left, midY - rect.top);
          state.canvas.zoomToPoint(point, newZoom);

          // Relative pan with finger movement
          const dx = midX - initialMidX;
          const dy = midY - initialMidY;
          state.canvas.relativePan(new fabric.Point(dx, dy));
          initialMidX = midX;
          initialMidY = midY;

          updateZoomDisplay();
        }
        e.preventDefault();
      }
    }, { passive: false });

    container.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        isPinching = false;
      }
    });
  }

  // ==========================================
  // MOBILE BOTTOM SHEETS CONTROLLER
  // ==========================================
  function setupMobileSheets() {
    const backdrop = document.getElementById('mobile-sheet-backdrop');
    const sheet = document.getElementById('mobile-bottom-sheet');
    const closeBtn = document.getElementById('btn-close-sheet');
    const titleEl = document.getElementById('mobile-sheet-title');
    const iconEl = document.getElementById('mobile-sheet-icon');
    const tabBtns = document.querySelectorAll('.mobile-tab-btn');

    let currentOpenTab = null;

    function openTab(tabKey) {
      if (currentOpenTab === tabKey) {
        closeSheet();
        return;
      }

      currentOpenTab = tabKey;
      tabBtns.forEach(btn => {
        if (btn.dataset.mobileTab === tabKey) {
          btn.classList.add('text-blue-400');
          btn.classList.remove('text-slate-400');
        } else {
          btn.classList.remove('text-blue-400');
          btn.classList.add('text-slate-400');
        }
      });

      // Hide all panes, show matching pane
      document.querySelectorAll('.mobile-pane').forEach(pane => pane.classList.add('hidden'));
      const activePane = document.getElementById(`pane-mobile-${tabKey}`);
      if (activePane) activePane.classList.remove('hidden');

      // Update Sheet Title & Icon
      const titles = {
        teeth: { title: 'Tooth Library & Archetypes', icon: 'fa-tooth' },
        guides: { title: 'Facial Reference Lines & Rulers', icon: 'fa-compass-drafting' },
        shade: { title: 'Enamel Shade & Opacity', icon: 'fa-palette' },
        inspect: { title: 'Biometric Tooth Inspector', icon: 'fa-ruler-combined' },
        export: { title: 'Export & Share Design', icon: 'fa-share-nodes' }
      };

      if (titles[tabKey]) {
        if (titleEl) titleEl.textContent = titles[tabKey].title;
        if (iconEl) iconEl.className = `fa-solid ${titles[tabKey].icon} text-blue-400 text-sm`;
      }

      if (backdrop) backdrop.classList.remove('hidden');
      if (sheet) sheet.classList.add('mobile-sheet-open');
    }

    function closeSheet() {
      currentOpenTab = null;
      tabBtns.forEach(btn => {
        btn.classList.remove('text-blue-400');
        btn.classList.add('text-slate-400');
      });
      if (sheet) sheet.classList.remove('mobile-sheet-open');
      if (backdrop) backdrop.classList.add('hidden');
    }

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.mobileTab;
        if (tab === 'copilot') {
          closeSheet();
          if (window.dsdCopilot && window.dsdCopilot.toggle) {
            window.dsdCopilot.toggle();
          }
          return;
        }
        if (tab) {
          // If copilot is open, close it so bottom sheet isn't covered
          const copilotModal = document.getElementById('dsd-copilot-modal');
          if (copilotModal && !copilotModal.classList.contains('hidden') && window.dsdCopilot) {
            window.dsdCopilot.toggle();
          }
          openTab(tab);
        }
      });
    });

    if (closeBtn) closeBtn.addEventListener('click', closeSheet);
    if (backdrop) backdrop.addEventListener('click', closeSheet);

    // Mobile Action Handlers
    const nativeShareBtn = document.getElementById('btn-native-share');
    if (nativeShareBtn) nativeShareBtn.onclick = shareDesign;

    const mExportJpg = document.getElementById('m-export-jpg');
    if (mExportJpg) mExportJpg.onclick = () => { closeSheet(); exportHighDpiJpg(false); };

    const mExportPdf = document.getElementById('m-export-pdf');
    if (mExportPdf) mExportPdf.onclick = () => { closeSheet(); exportPdfReport(); };

    const mExportPptx = document.getElementById('m-export-pptx');
    if (mExportPptx) mExportPptx.onclick = () => { closeSheet(); exportPowerPoint(); };

    const mOpacitySlider = document.getElementById('m-opacity-slider');
    if (mOpacitySlider) {
      mOpacitySlider.addEventListener('input', (e) => {
        applyOpacityToSelected(e.target.value);
        const mVal = document.getElementById('m-opacity-value');
        if (mVal) mVal.textContent = `${e.target.value}%`;
      });
    }

    // Mobile Reference Overlays toggles
    const mMidline = document.getElementById('m-toggle-midline');
    if (mMidline) mMidline.onclick = () => toggleReferenceLine('midline');

    const mInterpup = document.getElementById('m-toggle-interpupillary');
    if (mInterpup) mInterpup.onclick = () => toggleReferenceLine('interpupillary');

    const mCommissural = document.getElementById('m-toggle-commissural');
    if (mCommissural) mCommissural.onclick = () => toggleReferenceLine('commissural');

    const mSmileArc = document.getElementById('m-toggle-smilearc');
    if (mSmileArc) mSmileArc.onclick = () => toggleReferenceLine('smileArc');

    const mGoldenGrid = document.getElementById('m-toggle-goldengrid');
    if (mGoldenGrid) mGoldenGrid.onclick = () => toggleReferenceLine('goldenGrid');
  }

  // ==========================================
  // MOBILE NATIVE SHARING
  // ==========================================
  async function shareDesign() {
    if (!state.canvas) return;
    try {
      showToast('Preparing smile preview...', 'info');
      // Temporarily hide reference overlays for clean clinical export
      setReferenceLinesVisible(false);
      const dataUrl = state.canvas.toDataURL({ format: 'jpeg', quality: 0.92, multiplier: 2 });
      setReferenceLinesVisible(true);

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const fileName = `${sanitizeFileName(state.patientName)}_DSD_${state.caseId}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `DSD Smile Design - ${state.patientName}`,
          text: `Dentiscan Digital Smile Design for ${state.patientName} (${state.caseId})`
        });
        showToast('Shared successfully!', 'success');
      } else if (navigator.share) {
        await navigator.share({
          title: `DSD Smile Design - ${state.patientName}`,
          text: `Dentiscan Digital Smile Design for ${state.patientName} (${state.caseId})`,
          url: window.location.href
        });
        showToast('Shared successfully!', 'success');
      } else {
        // Fallback to direct JPG download
        exportHighDpiJpg(false);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Share failed:', err);
        exportHighDpiJpg(false);
      }
    }
  }

  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
      } else if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        duplicateSelected();
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        e.preventDefault();
        redo();
      } else if (e.key === 'Escape') {
        if (state.calibrationState !== 'IDLE') {
          cancelCalibration();
        }
      }
    });
  }

  // ==========================================
  // UTILITIES & TOASTS
  // ==========================================
  function showToast(message, type = 'info') {
    const toast = document.getElementById('app-toast');
    if (!toast) return;

    let icon = 'fa-circle-info text-blue-400';
    let borderColor = 'border-blue-500';
    if (type === 'success') {
      icon = 'fa-circle-check text-emerald-400';
      borderColor = 'border-emerald-500';
    } else if (type === 'error') {
      icon = 'fa-circle-exclamation text-rose-400';
      borderColor = 'border-rose-500';
    } else if (type === 'warning') {
      icon = 'fa-triangle-exclamation text-amber-400';
      borderColor = 'border-amber-500';
    }

    toast.className = `fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 text-slate-100 border ${borderColor} shadow-2xl transition-all duration-300 transform translate-y-0 opacity-100`;
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span class="text-xs font-medium">${message}</span>`;

    clearTimeout(toast.dataset.timer);
    toast.dataset.timer = setTimeout(() => {
      toast.className = 'fixed bottom-5 right-5 z-50 hidden transition-all duration-300 transform translate-y-4 opacity-0';
    }, 3200);
  }

  function sanitizeFileName(str) {
    return (str || 'Patient').replace(/[^a-z0-9_-]/gi, '_');
  }

  function downloadFile(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Comprehensive Clinical API Exposure for DSD Smart Clinical Copilot
  window.dsdApp = {
    state,
    startCalibration,
    cancelCalibration,
    confirmCalibration,
    setActiveArchetype,
    addToothToCanvas,
    addFullArchToCanvas,
    addSmileArcCurveToCanvas,
    addFacialAxisLinesToCanvas,
    addCalibratedRulerToCanvas,
    applyShadeToSelected,
    applyOpacityToSelected,
    flipSelectedHorizontal,
    duplicateSelected,
    deleteSelected,
    bringSelectedForward,
    sendSelectedBackward,
    toggleReferenceLine,
    exportHighDpiJpg,
    exportPowerPoint,
    exportPdfReport,
    shareDesign,
    loadInitialPatientSample,
    showToast,
    undo,
    redo,
    zoomIn,
    zoomOut,
    resetZoom,
    fitDesignToViewport,
    openMobileTab: (tabKey) => {
      const btn = document.querySelector(`.mobile-tab-btn[data-mobile-tab="${tabKey}"]`);
      if (btn) btn.click();
    },
    closeMobileSheet: () => {
      const closeBtn = document.getElementById('btn-close-sheet');
      if (closeBtn) closeBtn.click();
    }
  };

})();

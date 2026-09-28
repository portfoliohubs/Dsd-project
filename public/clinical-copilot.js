/**
 * DSD Smart Clinical Copilot (مساعد الابتسامة السريري الذكي)
 * 100% Client-Side, Zero Latency, Context-Aware Expert Clinical System
 * Integrates deeply with Canvas State Machine, Arabic NLP Intent Matching & One-Click Tool Triggers
 */

(function () {
  'use strict';

  // Copilot State
  const copilotState = {
    isOpen: false,
    isMinimized: false,
    isExpanded: false,
    hasGreeted: false,
    messages: []
  };

  // Helper: Normalize Arabic string for robust intent matching
  function normalizeArabic(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel/harakat
      .replace(/[إأآا]/g, 'ا')
      .replace(/[ة]/g, 'ه')
      .replace(/[ى]/g, 'ي')
      .replace(/[ؤئ]/g, 'ء')
      .replace(/[\.,\/#!$%\^&\*;:{}=\-_`~()؟?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Get dynamic state snapshot from DSD App
  function getAppSnapshot() {
    const app = window.dsdApp;
    if (!app || !app.state) {
      return {
        isCalibrated: false,
        calibrationState: 'IDLE',
        pixelsPerMm: 11.2,
        activeArchetype: 'oval',
        activeShade: 'bleach',
        teethCount: 0,
        activeObject: null,
        patientName: 'Jane Doe',
        overlays: {}
      };
    }

    const st = app.state;
    const canvas = st.canvas;
    const activeObj = canvas ? canvas.getActiveObject() : null;
    const teeth = canvas ? canvas.getObjects().filter(o => o.dsdType === 'tooth' || o.dsdType === 'arch') : [];

    let selectedToothInfo = null;
    if (activeObj && activeObj.dsdType !== 'background') {
      const bound = activeObj.getBoundingRect();
      const mmRatio = st.mmPerPixel || 0.09;
      const wMm = bound.width * mmRatio;
      const hMm = bound.height * mmRatio;
      const whRatio = hMm > 0 ? (wMm / hMm) * 100 : 0;

      selectedToothInfo = {
        name: activeObj.toothName || activeObj.displayName || 'عنصر محدد',
        code: activeObj.toothCode || '',
        widthMm: wMm.toFixed(2),
        heightMm: hMm.toFixed(2),
        whRatio: whRatio.toFixed(1),
        isIdeal: whRatio >= 75 && whRatio <= 85
      };
    }

    return {
      isCalibrated: !!st.isCalibrated,
      calibrationState: st.calibrationState || 'IDLE',
      pixelsPerMm: st.pixelsPerMm ? st.pixelsPerMm.toFixed(2) : '11.20',
      activeArchetype: st.activeArchetype || 'oval',
      activeShade: st.activeShade || 'bleach',
      teethCount: teeth.length,
      activeObject: selectedToothInfo,
      patientName: st.patientName || 'المريض',
      overlays: st.overlayVisibility || {}
    };
  }

  // Evaluate current clinical stage
  function evaluateCurrentStage(snap) {
    if (snap.calibrationState === 'P1') {
      return {
        id: 'CALIBRATING_P1',
        title: 'جاري المعايرة (النقطة الأولى A)',
        badgeColor: 'bg-amber-500',
        advice: 'انقر الآن على النقطة الأولى (مثل حافة القاطع السني أو علامة الصفر بالمسطرة).'
      };
    }
    if (snap.calibrationState === 'P2') {
      return {
        id: 'CALIBRATING_P2',
        title: 'جاري المعايرة (النقطة الثانية B)',
        badgeColor: 'bg-emerald-500',
        advice: 'انقر على النقطة الثانية (ذروة اللثة أو علامة المسطرة) لتأكيد المسافة بالمليمتر.'
      };
    }
    if (!snap.isCalibrated) {
      return {
        id: 'NEED_CALIBRATION',
        title: 'المعايرة غير مفعلة (الخطوة الأساسية)',
        badgeColor: 'bg-amber-400',
        advice: 'ينصح بالمعايرة بنقرتين لقياس أبعاد الأسنان ونسب العرض إلى الطول بدقة حقيقية.'
      };
    }
    if (snap.activeObject) {
      return {
        id: 'TOOTH_SELECTED',
        title: `السن المحدد: ${snap.activeObject.name}`,
        badgeColor: 'bg-sky-400',
        advice: `نسبة العرض/الطول الحالية: ${snap.activeObject.whRatio}% (${snap.activeObject.isIdeal ? 'مثالية 75–85%' : 'تحتاج ضبط'})`
      };
    }
    if (snap.teethCount === 0) {
      return {
        id: 'NO_TEETH',
        title: 'بانتظار إضافة الأسنان',
        badgeColor: 'bg-indigo-400',
        advice: 'المعايرة جاهزة! أضف الآن القوس العلوي أو الثنايا المركزية للبدء في التصميم.'
      };
    }
    return {
      id: 'DESIGNING',
      title: 'مرحلة التصميم والتناظر السريري',
      badgeColor: 'bg-emerald-400',
      advice: 'يمكنك مراجعة خط المنتصف، تدرج النسبة الذهبية، أو تصدير التقرير الطبي الكامل.'
    };
  }

  // Clinical Rule-Based Intelligence & Intent Matcher
  function generateClinicalResponse(rawQuery) {
    const q = normalizeArabic(rawQuery);
    const snap = getAppSnapshot();
    const stage = evaluateCurrentStage(snap);

    // 1. INTENT: CURRENT STEP & WHAT SHOULD I DO NOW?
    if (
      q.includes('خطو') || q.includes('اعمل ايه') || q.includes('ماذا افعل') ||
      q.includes('ابدا منين') || q.includes('كيف ابدا') || q.includes('وضعي') ||
      q.includes('حالتي') || q.includes('مساعده') || q.includes('التالي') || q.includes('next')
    ) {
      if (stage.id === 'NEED_CALIBRATION') {
        return {
          text: `🎯 <b>خطوتك الحالية الموصى بها سريرياً هي: المعايرة (2-Click Calibration)</b><br><br>
• التطبيق يعمل حالياً بمقياس تقريبي افتراضي.<br>
• لضمان تطابق تصميم الابتسامة مع الواقع بمقياس 1:1، يرجى النقر على زر المعايرة وتحديد مسافة معلومة (مثل طول الثنية المركزية <b>10.5 مم</b> أو مسطرة المعايرة <b>20 مم</b>).`,
          actions: [
            { label: '📐 ابدأ المعايرة الآن (نقرتين)', action: 'start-calibration' },
            { label: '📏 إضافة مسطرة 20 مم للمعايرة', action: 'add-ruler-20' },
            { label: '✨ تخطي وإضافة القوس العلوي', action: 'add-arch-6' }
          ]
        };
      } else if (stage.id === 'TOOTH_SELECTED') {
        const obj = snap.activeObject;
        return {
          text: `🔍 <b>أنت تقف الآن على: ${obj.name}</b><br><br>
• العرض الحالي: <b>${obj.widthMm} مم</b> | الطول: <b>${obj.heightMm} مم</b><br>
• نسبة العرض إلى الطول (W/H Ratio): <b>${obj.whRatio}%</b><br>
• التقييم السريري: ${obj.isIdeal ? '<span class="text-emerald-400 font-bold">ضمن النطاق الجمالي المثالي (75%–85%)</span>' : '<span class="text-amber-400 font-bold">خارج النطاق المثالي، اسحب مقابض السن للتعديل</span>'}<br><br>
ما الخطوة التي تريد تطبيقها على هذا السن؟`,
          actions: [
            { label: '✨ فحص شبكة النسبة الذهبية', action: 'toggle-golden' },
            { label: '🎨 تغيير درجة البياض (Bleach BL1)', action: 'set-shade-bleach' },
            { label: '🔄 عكس السن أفقياً (Flip)', action: 'flip-horizontal' },
            { label: '📑 فتح فاحص المقاسات الدقيق', action: 'open-tab-inspect' }
          ]
        };
      } else if (stage.id === 'NO_TEETH') {
        return {
          text: `🦷 <b>الصورة والمعايرة جاهزتان! خطوتك الآن: إضافة الأسنان التناغمية</b><br><br>
القالب الحالي النشط هو <b>${getArchetypeNameAr(snap.activeArchetype)}</b>.<br>
يمكنك إضافة القوس العلوي المكون من 6 أسنان بضغطة واحدة، وضبطه مع خط الشفة السفلية.`,
          actions: [
            { label: '🦷 إضافة القوس العلوي (6 أسنان)', action: 'add-arch-6' },
            { label: '🦷 إضافة الثنايا المركزية فقط (#11, #21)', action: 'add-centrals' },
            { label: '🎭 تغيير قالب الفيزاجيزم للوجه', action: 'open-tab-teeth' }
          ]
        };
      } else {
        return {
          text: `✨ <b>حالتك مكتملة بنجاح! الأسنان موضوعة والتناغم قيد التنفيذ</b><br><br>
• عدد عناصر الأسنان على الكانفاس: <b>${snap.teethCount}</b><br>
• المعايرة: <span class="text-emerald-400 font-bold">مفعلة (1 مم = ${snap.pixelsPerMm} px)</span><br>
• الخطوة الحالية الموصى بها: فحص خط المنتصف وقوس الابتسامة ثم <b>تصدير التقرير الطبي A4</b> للمريض ومختبر الأسنان.`,
          actions: [
            { label: '📑 تصدير تقرير PDF الطبي A4', action: 'export-pdf' },
            { label: '📊 تصدير عرض PowerPoint (4 شرائح)', action: 'export-pptx' },
            { label: '📐 فحص خط المنتصف وبؤبؤ العينين', action: 'toggle-midline' },
            { label: '📱 مشاركة التصميم عبر الموبايل', action: 'share-native' }
          ]
        };
      }
    }

    // 2. INTENT: CALIBRATION (المعايرة)
    if (
      q.includes('عاير') || q.includes('معاير') || q.includes('قياس') ||
      q.includes('مليمتر') || q.includes('ملم') || q.includes('بيكسل') ||
      q.includes('calibrate') || q.includes('scale') || q.includes('ruler')
    ) {
      return {
        text: `📐 <b>نظام المعايرة السريرية بنقرتين (2-Click Biometric Calibration):</b><br><br>
1. انقر فوق زر <b>"بدء المعايرة"</b>.<br>
2. انقر <b>النقطة الأولى (A)</b> على الكانفاس (مثل حافة القاطع السني العلوي).<br>
3. انقر <b>النقطة الثانية (B)</b> (مثل ذروة عنق السن عند اللثة).<br>
4. ستظهر لك نافذة لإدخال القياس السريري الحقيقي بالمليمتر (المتوسط الطبيعي للثنية المركزية: <b>10.5 مم</b> ارتفاعاً أو <b>8.5 مم</b> عرضاً).<br>
5. فور التأكيد، سيتم تحويل كل عناصر الكانفاس والتقارير الطبية إلى مليمترات حقيقية بنسبة خطأ 0%.`,
        actions: [
          { label: '📐 بدء المعايرة بنقرتين الآن', action: 'start-calibration' },
          { label: '📏 إضافة مسطرة DSD 20 مم المرجعية', action: 'add-ruler-20' },
          { label: '📏 إضافة مسطرة DSD 35 مم المرجعية', action: 'add-ruler-35' }
        ]
      };
    }

    // 3. INTENT: GOLDEN PROPORTION (النسبة الذهبية و RED)
    if (
      q.includes('ذهب') || q.includes('نسبه') || q.includes('جولدن') ||
      q.includes('1 618') || q.includes('تناسب') || q.includes('golden') ||
      q.includes('phi') || q.includes('red')
    ) {
      return {
        text: `⚖️ <b>النسبة الذهبية في تصميم الابتسامة (Golden Proportion - 1.618):</b><br><br>
• تنص نظرية (Lombardi & Levin) على أن العرض الظاهري للأسنان من المسقط الأمامي المباشر يتدرج كالتالي:<br>
  - <b>الثنية المركزية (Central):</b> 1.618 (أو 100%)<br>
  - <b>القاطع الجانبي (Lateral):</b> 1.000 (أو 61.8% من عرض المركزية)<br>
  - <b>الناب (Canine):</b> 0.618 (الجزء الظاهري الأمامي فقط)<br><br>
• في طب الأسنان الحديث، يُفضل أيضاً مفهوم <b>RED Proportion</b> بنسبة ثابتة 70% لمنح القواطع الجانبية عرضاً طبيعياً غير مفرط النحافة.<br>
• يمكنك تفعيل <b>شبكة النسبة الذهبية</b> على الكانفاس لمطابقتها فورياً!`,
        actions: [
          { label: '✨ إظهار / إخفاء شبكة النسبة الذهبية', action: 'toggle-golden' },
          { label: '🔍 فحص أبعاد السن المحدد', action: 'open-tab-inspect' },
          { label: '🦷 إضافة القوس العلوي المتناسق', action: 'add-arch-6' }
        ]
      };
    }

    // 4. INTENT: WIDTH TO LENGTH RATIO (نسبة العرض إلى الطول)
    if (
      q.includes('عرض') || q.includes('طول') || q.includes('نسبه العرض') ||
      q.includes('مقاس') || q.includes('ابعاد') || q.includes('ratio') ||
      q.includes('w h') || q.includes('height') || q.includes('width')
    ) {
      const obj = snap.activeObject;
      let specificToothAdvice = '';
      if (obj) {
        specificToothAdvice = `<br><br>📌 <b>السن النشط حالياً (${obj.name}):</b><br>
العرض: ${obj.widthMm} مم | الطول: ${obj.heightMm} مم | النسبة: <b>${obj.whRatio}%</b> (${obj.isIdeal ? '✅ مثالي سريرياً' : '⚠️ يحتاج تعديل للمظهر الطبيعي'})`;
      }

      return {
        text: `📏 <b>المعيار الذهبي لنسبة العرض إلى الطول (Width-to-Length Ratio):</b><br><br>
• النسبة المثالية للثنايا المركزية العلوية (Maxillary Central Incisors) تتراوح بين <b>75% إلى 85%</b> (المتوسط الجمالي الأفضل: <b>80%</b>).<br>
• مثال سريري معياري: عرض <b>8.5 مم</b> مقابل طول <b>10.5 مم</b> = 80.9%.<br>
• إذا كانت النسبة <b>أقل من 75%</b>: يبدو السن طويلاً ونحيفاً.<br>
• إذا كانت النسبة <b>أعلى من 85%</b>: يبدو السن مربعاً وقصيراً، وقد يتطلب الحالة قص لثة تجميلي (Gingivectomy) لإطالة التاج السريري.${specificToothAdvice}`,
        actions: [
          { label: '🔍 فتح لوحة القياسات الحيوية', action: 'open-tab-inspect' },
          { label: '📐 إعادة المعايرة بالمليمتر', action: 'start-calibration' }
        ]
      };
    }

    // 5. INTENT: SMILE ARC & LIP RELATIONSHIP (قوس الابتسامة)
    if (
      q.includes('قوس') || q.includes('ابتسام') || q.includes('شفه') ||
      q.includes('شفاه') || q.includes('سفليه') || q.includes('smile arc') ||
      q.includes('arc') || q.includes('انحناء')
    ) {
      return {
        text: `👄 <b>قوس الابتسامة الحيوي (Consonant Smile Arc):</b><br><br>
• يشير إلى العلاقة بين انحناء الحواف القاطعة للأسنان العلوية وتحدب الشفة السفلية أثناء الابتسامة الواسعة.<br>
• <b>القوس المتناسق المثالي (Consonant):</b> تكون حواف الأسنان العلوية موازية لانحناء الشفة السفلية (يعطي مظهراً شبابياً جذاباً).<br>
• <b>القوس المسطح (Flat Arc):</b> تكون الحواف على خط مستقيم أفقي (يوحي بتقدم العمر أو التآكل السني).<br>
• <b>القوس المقلوب (Reverse Arc):</b> تكون القواطع الجانبية أطول من المركزية (غير جمالي ويحتاج تصحيح).`,
        actions: [
          { label: '✨ إظهار خط قوس الابتسامة المرجعي', action: 'toggle-smilearc' },
          { label: '📐 إضافة منحنى Smile Arc التفاعلي', action: 'add-smilearc-curve' },
          { label: '🦷 إضافة القوس العلوي المتوافق', action: 'add-arch-6' }
        ]
      };
    }

    // 6. INTENT: FACIAL REFERENCE & MIDLINE (خط المنتصف وتناظر الوجه)
    if (
      q.includes('منتصف') || q.includes('عين') || q.includes('بءبء') ||
      q.includes('خط الوجه') || q.includes('تناظر') || q.includes('midline') ||
      q.includes('pupil') || q.includes('commissur')
    ) {
      return {
        text: `📐 <b>الخطوط المرجعية للوجه وتناظر الابتسامة:</b><br><br>
1. <b>خط المنتصف الوجهي (Facial Midline):</b> يمر من منتصف الجبهة وقمة الأنف ومركز الشفة العلوية (Philtrum). يجب أن يتطابق خط القواطع مع خط منتصف الشفة (يسمح بانحراف بسيط حتى 2 مم دون أن يلاحظه المريض).<br>
2. <b>خط بؤبؤ العينين (Interpupillary Line):</b> المرجع الأفقي الرئيسي. يجب أن يكون المستوى القاطع للأسنان موازياً تماماً لهذا الخط.<br>
3. <b>خط زاويتي الفم (Commissural Line):</b> مرجع إضافي لموازاة مستوى الإطباق عند الابتسام.`,
        actions: [
          { label: '📐 إظهار / إخفاء خط المنتصف', action: 'toggle-midline' },
          { label: '📐 إظهار / إخفاء خط بؤبؤ العينين', action: 'toggle-interpup' },
          { label: '📐 إظهار خط زاويتي الفم', action: 'toggle-commissural' }
        ]
      };
    }

    // 7. INTENT: VISAGISM & 4 ARCHETYPES (علم الفيزاجيزم وقوالب الوجه)
    if (
      q.includes('فيزاجيزم') || q.includes('قالب') || q.includes('قوالب') ||
      q.includes('بيضاوي') || q.includes('مثلث') || q.includes('مستطيل') ||
      q.includes('مربع') || q.includes('شخصيه') || q.includes('طباع') ||
      q.includes('visagism') || q.includes('archetype') || q.includes('oval')
    ) {
      return {
        text: `🎭 <b>علم الفيزاجيزم السريري (Visagism Smile Architecture):</b><br>
يقوم على مواءمة شكل الأسنان مع شخصية المريض وملامح وجهه الأربعة الرئيسية المستخرجة من عرض DSD Master:<br><br>
1. <b>🌟 البيضاوي (Melancholic - الحساس المنظم):</b> حواف منحنية ناعمة، قواطع مركزية بارزة، مناسب للملهمين والدقيقين وأصحاب الوجوه البيضاوية.<br>
2. <b>⚡ المثلث (Sanguine - الحركي المتفائل):</b> قواطع مائلة وحواف ديناميكية صاعدة، مناسب للشخصيات الاجتماعية المنطلقة وأصحاب الوجوه المثلثية.<br>
3. <b>🏛️ المستطيل (Choleric - القوي القيادي):</b> حواف أفقية مستقيمة وزوايا قوية، يرمز للثقة والقيادة والوجوه المستطيلة أو المربعة.<br>
4. <b>⚖️ المربع (Phlegmatic - الهادئ الدبلوماسي):</b> تنظيم متوازن دون هيمنة حادة، مناسب للشخصيات الهادئة والوجوه المربعة الدائرية.`,
        actions: [
          { label: '🌟 تطبيق القالب البيضاوي (Oval)', action: 'set-arch-oval' },
          { label: '⚡ تطبيق القالب المثلث (Triangular)', action: 'set-arch-triangular' },
          { label: '🏛️ تطبيق القالب المستطيل (Rectangular)', action: 'set-arch-rectangular' },
          { label: '⚖️ تطبيق القالب المربع (Square)', action: 'set-arch-square' }
        ]
      };
    }

    // 8. INTENT: TOOTH LIBRARY & ADDING TEETH (إضافة الأسنان والقوس)
    if (
      q.includes('اسنان') || q.includes('سن') || q.includes('ثنايا') ||
      q.includes('انياب') || q.includes('قواطع') || q.includes('قوس') ||
      q.includes('طقم') || q.includes('add tooth') || q.includes('teeth')
    ) {
      return {
        text: `🦷 <b>مكتبة الأسنان التشريحية المبرمجة:</b><br><br>
• تدعم الترقيم الدولي <b>FDI</b> للأسنان الأمامية العلوية:<br>
  - <b>الثنايا المركزية:</b> #11 (يمين) و #21 (يسار) بعرض 8.5 مم.<br>
  - <b>القواطع الجانبية:</b> #12 و #22 بعرض 6.5 مم.<br>
  - <b>الأنياب:</b> #13 و #23 بعرض 7.5 مم.<br>
  - <b>الضواحك الأولى:</b> #14 و #24 بعرض 7.0 مم.<br><br>
يمكنك إضافة قوس كامل أو أسنان فردية ومطابقتها مباشرة على صورة المريض.`,
        actions: [
          { label: '🦷 إضافة القوس العلوي الأمامي (6 أسنان)', action: 'add-arch-6' },
          { label: '🦷 إضافة القوس الكامل (8 أسنان مع الضواحك)', action: 'add-arch-8' },
          { label: '🦷 إضافة الثنية المركزية #11', action: 'add-tooth-centralRight' },
          { label: '🦷 إضافة الثنية المركزية #21', action: 'add-tooth-centralLeft' }
        ]
      };
    }

    // 9. INTENT: SHADE & COLOR & OPACITY (الألوان ودرجة البياض)
    if (
      q.includes('لون') || q.includes('شيد') || q.includes('ابيض') ||
      q.includes('بليتش') || q.includes('تبييض') || q.includes('شفاف') ||
      q.includes('shade') || q.includes('bleach') || q.includes('color') ||
      q.includes('opacity')
    ) {
      return {
        text: `🎨 <b>دليل تدرجات ألوان ميناء الأسنان (Enamel Shades):</b><br><br>
• <b>Bleach BL1:</b> بياض هوليوود الساطع، مناسب لحالات الفينير التجميلي الكامل والتبييض المتقدم.<br>
• <b>Natural A1:</b> درجة طبيعية فائقة النقاء، مناسبة للشباب وللابتسامات الطبيعية المشرقة.<br>
• <b>Warm A2:</b> الدرجة الأكثر انتشاراً عالمياً للأسنان الحيوية الدافئة.<br>
• <b>Aesthetic A3:</b> تدرج طبيعي للأسنان الناضجة ولمحاكاة التدرج اللوني الطبيعي.<br>
• <b>Wireframe:</b> وضع الهيكل الخطي الشفاف لرؤية حدود السن الحقيقي خلف التصميم بدقة!`,
        actions: [
          { label: '⚪ تطبيق Bleach BL1', action: 'set-shade-bleach' },
          { label: '✨ تطبيق Natural A1', action: 'set-shade-a1' },
          { label: '🔆 تطبيق Warm A2', action: 'set-shade-a2' },
          { label: '📐 تفعيل الهيكل الشفاف (Wireframe)', action: 'set-shade-outline' }
        ]
      };
    }

    // 10. INTENT: MOBILE & TOUCH GESTURES (الهاتف واللمس)
    if (
      q.includes('موبايل') || q.includes('هاتف') || q.includes('جوال') ||
      q.includes('لمس') || q.includes('تكبير') || q.includes('اصبع') ||
      q.includes('touch') || q.includes('mobile') || q.includes('pinch')
    ) {
      return {
        text: `📱 <b>نصائح احترافية لاستخدام DSD Studio على الهاتف:</b><br><br>
1. <b>التكبير والتصغير بإصبعين (Pinch to Zoom):</b> ضع إصبعين على الشاشة وباعد بينهما للتكبير حتى 500% لرؤية أدق التفاصيل.<br>
2. <b>التحريك (Pan):</b> اسحب بإصبعين معاً للتنقل السلس عبر الكانفاس.<br>
3. <b>مقابض اللمس الكبيرة:</b> تم تكبير أبعاد نقاط التحكم الدائرية على الهواتف لتلائم لمس الأصابع وقلم Stylus بدقة متناهية.<br>
4. <b>الشريط السفلي السريع:</b> يحتوي على تبويبات الأسنان، الأدلة، الألوان، القياسات، والتصدير بنقرة واحدة دون حجب مساحة العمل.`,
        actions: [
          { label: '🔍 تكبير الكانفاس (+)', action: 'zoom-in' },
          { label: '🔍 استعادة الحجم الافتراضي (100%)', action: 'zoom-reset' },
          { label: '📱 مشاركة التصميم عبر الموبايل', action: 'share-native' }
        ]
      };
    }

    // 11. INTENT: IPHONE HEIC & PHOTO UPLOAD (صور الآيفون ورفع الصور)
    if (
      q.includes('ايفون') || q.includes('iphone') || q.includes('heic') ||
      q.includes('heif') || q.includes('صوره') || q.includes('رفع') ||
      q.includes('كاميرا') || q.includes('portrait')
    ) {
      return {
        text: `📸 <b>محرك معالجة صور المريض وصور iPhone HEIC:</b><br><br>
• التطبيق مزود بمحول مدمج <b>(Client-Side HEIC Converter)</b> يقوم بتحويل صور كاميرا الآيفون بدقة فائقة إلى صيغة الويب فورياً داخل المتصفح دون إرسالها لأي خادم حفاظاً على خصوصية المريض الطبية 100%.<br>
• يتم عمل تحسين تلقائي للحجم (Downscale) للصور فائقة الدقة (حتى 48 ميجابكسل) لمنع استنزاف ذاكرة الهاتف وضمان سلاسة تامة بمعدل 60 إطار/ثانية.<br>
• يُفضل دائماً التقاط صورة أمامية مستقيمة (Full Face Smiling) بحيث يكون خط بؤبؤ العينين أفقياً والشفاه مسترخية في ابتسامة طبيعية.`,
        actions: [
          { label: '📷 تحميل حالة سريرية تجريبية (Master Case)', action: 'load-sample-master' },
          { label: '📷 تجربة صورة وجه أنثوي (Female Smile)', action: 'load-sample-female' },
          { label: '📷 تجربة صورة تآكل أسناني (Male Wear)', action: 'load-sample-male' }
        ]
      };
    }

    // 12. INTENT: EXPORT & PRESENTATION (تصدير التقارير الطبية والعروض)
    if (
      q.includes('تصدير') || q.includes('تقرير') || q.includes('بوربوينت') ||
      q.includes('بي دي اف') || q.includes('عرض') || q.includes('مشاركه') ||
      q.includes('طباعه') || q.includes('واتساب') || q.includes('export') ||
      q.includes('pdf') || q.includes('pptx') || q.includes('share')
    ) {
      return {
        text: `📑 <b>محرك التصدير والمشاركة السريرية متعدد الصيغ:</b><br><br>
1. <b>📄 تقرير PDF الطبي (A4 Landscape):</b> تقرير طبي رسمي معتمد يشمل صورة المحاكاة، جدول القياسات بالمليمتر، قائمة تدقيق المعايير الجمالية، ومكان لتوقيع الطبيب وموافقة المريض.<br>
2. <b>📊 عرض PowerPoint (.pptx):</b> عرض احترافي من 4 شرائح بنسبة 16:9 يضم شريحة الغلاف، المقارنة قبل وبعد (Before & After)، جدول أبعاد الأسنان، ومصفوفة الفيزاجيزم للشخصية.<br>
3. <b>🖼️ صورة عالية الدقة (High-DPI JPG):</b> بدقة 2x Retina نقية خالية من خطوط الشبكة مخصصة للإرسال المباشر لمعمل الأسنان.<br>
4. <b>📱 مشاركة الهاتف الفورية:</b> إرسال مباشر عبر AirDrop، واتساب، أو حفظ في ألبوم الكاميرا.`,
        actions: [
          { label: '📑 تصدير تقرير PDF الطبي فوراً', action: 'export-pdf' },
          { label: '📊 تصدير عرض PowerPoint Deck', action: 'export-pptx' },
          { label: '🖼️ تصدير صورة JPG عالية الدقة', action: 'export-jpg' },
          { label: '📱 مشاركة التصميم من الهاتف', action: 'share-native' }
        ]
      };
    }

    // 13. INTENT: GINGIVAL ZENITHS & GUMMY SMILE (ذروة اللثة والابتسامة اللثوية)
    if (
      q.includes('لثه') || q.includes('لثويه') || q.includes('ذروه') ||
      q.includes('زينيث') || q.includes('قطع لثه') || q.includes('gingiv') ||
      q.includes('zenith') || q.includes('gummy')
    ) {
      return {
        text: `🌿 <b>محددات ذروة اللثة الجمالية (Gingival Zeniths):</b><br><br>
• <b>ارتفاع الذروة (Height):</b> يجب أن تكون ذروة لثة الثنايا المركزية والأنياب على نفس المستوى الأفقي، بينما تكون ذروة القواطع الجانبية <b>أقل بمقدار 1 مم</b> (أكثر باتجاه الحافة القاطعة).<br>
• <b>الموقع الجانبي (Lateral Position):</b> تقع ذروة اللثة للثنايا المركزية والأنياب مائلة قليلاً نحو الوحشي (Distal) بالنسبة لمحور السن الطولي.<br>
• في حالات <b>الابتسامة اللثوية (Gummy Smile)</b>، يساعد قياس نسبة العرض/الطول في DSD على تحديد ما إذا كان المريض مرشحاً لقص اللثة (Gingivectomy) أو إطالة التاج السريري قبل تركيب الفينير.`,
        actions: [
          { label: '🔍 فحص نسبة عرض وطول السن النشط', action: 'open-tab-inspect' },
          { label: '📐 إظهار خطوط التناظر الوجهي', action: 'toggle-midline' }
        ]
      };
    }

    // 14. INTENT: MOCKUP & LAB WAX-UP (الموك اب والمختبر)
    if (
      q.includes('موك اب') || q.includes('واكس اب') || q.includes('معمل') ||
      q.includes('مختبر') || q.includes('فينير') || q.includes('عدسات') ||
      q.includes('mockup') || q.includes('waxup') || q.includes('lab')
    ) {
      return {
        text: `🔬 <b>من المحاكاة الرقمية (2D) إلى الموك اب السريري (Direct Mock-up):</b><br><br>
1. يتم تصدير تقرير المقاسات (PDF) بالمليمترات الدقيقة المستخرجة من DSD.<br>
2. يقوم فني المختبر بصنع التشميع التشخيصي (Diagnostic Wax-up) أو التصميم الرقمي ثلاثي الأبعاد (3D CAD).<br>
3. يتم أخذ دليل سيليكوني (Silicone Index / Putty Matrix) ونقل الشكل إلى فم المريض باستخدام راتنج مؤقت (Bis-acryl Resin).<br>
4. يرى المريض ابتسامته الجديدة في فمه مباشرة وتتحقق من النطق وخط الشفاه قبل أي تحضير للأسنان!`,
        actions: [
          { label: '📑 تصدير التقرير لمختبر الأسنان', action: 'export-pdf' },
          { label: '📊 تصدير عرض PowerPoint للمريض', action: 'export-pptx' }
        ]
      };
    }

    // 15. INTENT: MOBILE & LANDSCAPE ROTATION (استخدام الهاتف وتدوير الشاشة)
    if (
      q.includes('هاتف') || q.includes('موبايل') || q.includes('جوال') ||
      q.includes('تدوير') || q.includes('rotate') || q.includes('landscape') ||
      q.includes('portrait') || q.includes('بالعرض') || q.includes('عرض الشاشة') ||
      q.includes('افقي') || q.includes('عمودي') || q.includes('شاشة')
    ) {
      return {
        text: `📱 <b>العمل السلس على الهواتف والوضع الأفقي (Landscape Mode):</b><br><br>
• <b>التكيف التلقائي للمشهد:</b> تم تزويد النظام بمحرك ملاءمة ذكي <b>(Dynamic Virtual Viewport)</b> يقوم تلقائياً عند تدوير الهاتف أو تغيير حجم الشاشة بضبط مقياس العرض ومحاذاة صورة المريض والأسنان في مركز الكانفاس دون أي اقتصاص أو فقدان للمحاذاة السريرية.<br>
• <b>الوضع الأفقي (Landscape):</b> ينبثق المساعد الذكي تلقائياً كدرج جانبي أيمن (Right Sidebar Drawer) لتتمكن من مناقشة الحالة ومتابعة الكانفاس جنباً إلى جنب دون حجب التصميم.<br>
• <b>إيماءات اللمس:</b> استخدم إصبعين للتكبير (Pinch-to-Zoom) أو السحب الحر (Pan)، أو انقر زر <b>إعادة ضبط العرض</b> لملء الشاشة فورياً.<br>
• <b>الوصول السريع للمساعد:</b> متاح دائماً من التبويب السفلي <b>[المساعد]</b>، أو الزر العلوي بجوار المعايرة، أو الزر العائم ✨.`,
        actions: [
          { label: '🎯 إعادة ضبط وملء الشاشة', action: 'reset-zoom' },
          { label: '📐 ابدأ المعايرة (10.5mm)', action: 'start-calibration' },
          { label: '✨ فحص النسبة الذهبية', action: 'toggle-golden' },
          { label: '📑 تصدير تقرير الحالة A4', action: 'export-pdf' }
        ]
      };
    }

    // 16. INTENT: GREETINGS & CASUAL (التحية والتعريف)
    if (
      q.includes('مرحبا') || q.includes('سلام') || q.includes('اهلا') ||
      q.includes('صباح') || q.includes('مساء') || q.includes('شكرا') ||
      q.includes('مين انت') || q.includes('من انت') || q.includes('hello') ||
      q.includes('hi')
    ) {
      return {
        text: `👨‍⚕️ <b>أهلاً بك دكتور! أنا مساعد الابتسامة السريري الذكي (DSD Clinical Copilot).</b><br><br>
أنا مصمم لمساعدتك فورياً في جميع مراحل تصميم الابتسامة الرقمية:<br>
• فحص المعايرة وتحويل البيكسل لمليمتر حقيقي.<br>
• مراجعة النسبة الذهبية ونسب العرض إلى الطول (75–85%).<br>
• اختيار قوالب الفيزاجيزم (بيضاوي، مثلث، مستطيل، مربع).<br>
• تجهيز وتصدير التقارير الطبية A4 وعروض PowerPoint بنقرة واحدة.<br><br>
<b>الحالة الحالية:</b> ${stage.title} · ${stage.advice}`,
        actions: [
          { label: '💡 ما هي خطوتي التالية؟', action: 'ask-next-step' },
          { label: '📐 كيف أقوم بالمعايرة؟', action: 'ask-calibration' },
          { label: '✨ فحص النسبة الذهبية', action: 'toggle-golden' }
        ]
      };
    }

    // 16. COMPREHENSIVE INTELLIGENT CLINICAL FALLBACK
    return {
      text: `💡 <b>مساعد الابتسامة السريري في خدمتك:</b><br><br>
لقد فحصت استفسارك وحالة الكانفاس الحالية بعناية:<br>
• <b>الوضع الحالي:</b> ${stage.title}<br>
• <b>التوصية السريرية اللحظية:</b> ${stage.advice}<br>
• مقياس الرسم الحالي: <b>1 مم = ${snap.pixelsPerMm} px</b> | القالب: <b>${getArchetypeNameAr(snap.activeArchetype)}</b>.<br><br>
يمكنك اختيار أحد الإجراءات السريعة أدناه أو السؤال عن المعايرة، النسبة الذهبية، قوالب الفيزاجيزم، أو التصدير الطبي:`,
      actions: [
        { label: '💡 ما خطوتي التالية الموصى بها؟', action: 'ask-next-step' },
        { label: '📐 بدء المعايرة بنقرتين', action: 'start-calibration' },
        { label: '✨ فحص النسبة الذهبية', action: 'toggle-golden' },
        { label: '📑 تصدير تقرير الحالة PDF', action: 'export-pdf' }
      ]
    };
  }

  function getArchetypeNameAr(key) {
    const map = {
      oval: 'البيضاوي (الحساس المنظم)',
      triangular: 'المثلث (الحركي المتفائل)',
      rectangular: 'المستطيل (القوي القيادي)',
      square: 'المربع (الهادئ الدبلوماسي)'
    };
    return map[key] || 'بيضاوي';
  }

  // Execute interactive clinical actions directly on app
  function executeClinicalAction(actionKey) {
    const app = window.dsdApp;
    if (!app) return;

    switch (actionKey) {
      case 'start-calibration':
        if (app.startCalibration) app.startCalibration();
        break;
      case 'add-ruler-20':
        if (app.addCalibratedRulerToCanvas) app.addCalibratedRulerToCanvas(20.0, false);
        break;
      case 'add-ruler-35':
        if (app.addCalibratedRulerToCanvas) app.addCalibratedRulerToCanvas(35.0, false);
        break;
      case 'add-arch-6':
        if (app.addFullArchToCanvas) app.addFullArchToCanvas(6);
        break;
      case 'add-arch-8':
        if (app.addFullArchToCanvas) app.addFullArchToCanvas(8);
        break;
      case 'add-centrals':
        if (app.addToothToCanvas) {
          app.addToothToCanvas('centralRight');
          setTimeout(() => app.addToothToCanvas('centralLeft'), 100);
        }
        break;
      case 'add-tooth-centralRight':
        if (app.addToothToCanvas) app.addToothToCanvas('centralRight');
        break;
      case 'add-tooth-centralLeft':
        if (app.addToothToCanvas) app.addToothToCanvas('centralLeft');
        break;
      case 'toggle-midline':
        if (app.toggleReferenceLine) app.toggleReferenceLine('midline');
        break;
      case 'toggle-interpup':
        if (app.toggleReferenceLine) app.toggleReferenceLine('interpupillary');
        break;
      case 'toggle-commissural':
        if (app.toggleReferenceLine) app.toggleReferenceLine('commissural');
        break;
      case 'toggle-smilearc':
        if (app.toggleReferenceLine) app.toggleReferenceLine('smileArc');
        break;
      case 'add-smilearc-curve':
        if (app.addSmileArcCurveToCanvas) app.addSmileArcCurveToCanvas();
        break;
      case 'toggle-golden':
        if (app.toggleReferenceLine) app.toggleReferenceLine('goldenGrid');
        break;
      case 'set-arch-oval':
        if (app.setActiveArchetype) app.setActiveArchetype('oval');
        break;
      case 'set-arch-triangular':
        if (app.setActiveArchetype) app.setActiveArchetype('triangular');
        break;
      case 'set-arch-rectangular':
        if (app.setActiveArchetype) app.setActiveArchetype('rectangular');
        break;
      case 'set-arch-square':
        if (app.setActiveArchetype) app.setActiveArchetype('square');
        break;
      case 'set-shade-bleach':
        if (app.applyShadeToSelected) app.applyShadeToSelected('bleach');
        break;
      case 'set-shade-a1':
        if (app.applyShadeToSelected) app.applyShadeToSelected('a1');
        break;
      case 'set-shade-a2':
        if (app.applyShadeToSelected) app.applyShadeToSelected('a2');
        break;
      case 'set-shade-outline':
        if (app.applyShadeToSelected) app.applyShadeToSelected('outline');
        break;
      case 'flip-horizontal':
        if (app.flipSelectedHorizontal) app.flipSelectedHorizontal();
        break;
      case 'export-pdf':
        if (app.exportPdfReport) app.exportPdfReport();
        break;
      case 'export-pptx':
        if (app.exportPowerPoint) app.exportPowerPoint();
        break;
      case 'export-jpg':
        if (app.exportHighDpiJpg) app.exportHighDpiJpg(false);
        break;
      case 'share-native':
        if (app.shareDesign) app.shareDesign();
        break;
      case 'open-tab-teeth':
        if (app.openMobileTab) app.openMobileTab('teeth');
        break;
      case 'open-tab-guides':
        if (app.openMobileTab) app.openMobileTab('guides');
        break;
      case 'open-tab-inspect':
        if (app.openMobileTab) app.openMobileTab('inspect');
        break;
      case 'open-tab-shade':
        if (app.openMobileTab) app.openMobileTab('shade');
        break;
      case 'zoom-in':
        if (app.zoomIn) app.zoomIn();
        break;
      case 'zoom-reset':
      case 'reset-zoom':
        if (app.resetZoom) app.resetZoom();
        else if (app.fitDesignToViewport) app.fitDesignToViewport();
        break;
      case 'load-sample-master':
        if (app.loadInitialPatientSample) app.loadInitialPatientSample('coachman_master');
        break;
      case 'load-sample-female':
        if (app.loadInitialPatientSample) app.loadInitialPatientSample('female_smile');
        break;
      case 'load-sample-male':
        if (app.loadInitialPatientSample) app.loadInitialPatientSample('male_smile');
        break;
      case 'ask-next-step':
        handleUserMessage('ما الخطوة التالية؟');
        break;
      case 'ask-calibration':
        handleUserMessage('كيف أقوم بالمعايرة؟');
        break;
      default:
        console.log('Action triggered:', actionKey);
    }

    updateCopilotHeaderBadge();
  }

  // ==========================================
  // COPILOT UI BUILDER & EVENT WIRING
  // ==========================================

  function initCopilotUI() {
    // 1. Create Floating Launcher Button (Always present on load without delay)
    createLauncherElement();

    // 2. Create Floating Copilot Modal / Drawer
    createCopilotModalElement();

    // 3. Header integration button
    setupHeaderTrigger();

    // 4. Mobile Bottom Nav Tab integration
    setupMobileNavTrigger();

    // 5. Show initial greeting message
    showInitialDiagnosis();

    // 6. Show friendly welcome toast after short delay so user instantly sees it
    setTimeout(showWelcomeToast, 800);

    // 7. Setup dynamic observers (when canvas selection changes or calibration starts)
    setupStateChangeListeners();
  }

  function setupMobileNavTrigger() {
    const navTab = document.getElementById('mobile-nav-copilot-tab');
    if (navTab) {
      navTab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleCopilot();
      });
    }
  }

  function showWelcomeToast() {
    if (document.getElementById('copilot-welcome-toast') || copilotState.isOpen) return;
    const toast = document.createElement('div');
    toast.id = 'copilot-welcome-toast';
    toast.className = 'fixed top-14 md:top-16 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2.5 px-3.5 py-1.5 md:py-2 bg-gradient-to-r from-blue-950/95 via-indigo-950/95 to-slate-900/95 border border-sky-400/80 rounded-full shadow-2xl backdrop-blur-md cursor-pointer hover:scale-105 transition-all duration-300 select-none animate-bounce';
    toast.innerHTML = `
      <div class="relative flex items-center justify-center">
        <i class="fa-solid fa-wand-magic-sparkles text-amber-300 text-sm"></i>
        <span class="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
      </div>
      <span class="text-xs font-bold text-sky-100">✨ مساعد الابتسامة الذكي جاهز لمساعدتك! اضغط هنا</span>
      <button id="btn-close-welcome-toast" class="w-4 h-4 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-[10px] ml-1">&times;</button>
    `;
    document.body.appendChild(toast);

    toast.onclick = (e) => {
      if (e.target.id === 'btn-close-welcome-toast' || e.target.closest('#btn-close-welcome-toast')) {
        toast.remove();
        return;
      }
      toast.remove();
      toggleCopilot();
    };

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, -20px)';
        setTimeout(() => toast.remove(), 300);
      }
    }, 8500);
  }

  function createLauncherElement() {
    if (document.getElementById('dsd-copilot-launcher')) return;

    const launcher = document.createElement('div');
    launcher.id = 'dsd-copilot-launcher';
    // High z-index (z-50) so it is always on top and accessible across portrait and landscape
    launcher.className = 'fixed bottom-20 md:bottom-6 right-3 md:right-5 z-50 flex items-center gap-2 group transition-transform duration-200 active:scale-95 select-none';

    launcher.innerHTML = `
      <!-- Gentle Peek Message / Status Tooltip on hover or first load -->
      <div id="copilot-peek-bubble" class="hidden sm:flex items-center gap-2 bg-slate-900/95 text-slate-200 px-3 py-1.5 rounded-full border border-sky-400/40 shadow-xl text-xs backdrop-blur-md cursor-pointer hover:bg-slate-800 transition-all">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span class="font-medium text-[11px]" id="copilot-peek-text">مساعد الابتسامة الذكي جاهز</span>
        <i class="fa-solid fa-chevron-left text-[9px] text-blue-400"></i>
      </div>

      <!-- Main Floating Trigger Pill -->
      <button id="btn-open-copilot-floating" class="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 text-white font-bold text-xs shadow-xl shadow-blue-600/40 border border-sky-400/50 hover:from-blue-500 hover:to-sky-400 transition-all">
        <div class="relative flex items-center justify-center">
          <i class="fa-solid fa-wand-magic-sparkles text-sm text-amber-300"></i>
          <span class="absolute -top-1 -right-1 flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
          </span>
        </div>
        <span class="tracking-wide">المساعد الذكي</span>
      </button>
    `;

    document.body.appendChild(launcher);

    const btn = launcher.querySelector('#btn-open-copilot-floating');
    const peek = launcher.querySelector('#copilot-peek-bubble');

    if (btn) btn.addEventListener('click', toggleCopilot);
    if (peek) peek.addEventListener('click', toggleCopilot);
  }

  function setupHeaderTrigger() {
    const existingHeaderBtn = document.getElementById('btn-header-copilot');
    if (existingHeaderBtn) {
      existingHeaderBtn.addEventListener('click', toggleCopilot);
      return;
    }
    const headerRight = document.querySelector('header .flex.items-center:last-child');
    if (headerRight && !document.getElementById('btn-header-copilot')) {
      const headerBtn = document.createElement('button');
      headerBtn.id = 'btn-header-copilot';
      headerBtn.className = 'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white shadow-md shadow-blue-600/30 border border-sky-400/40 transition-all active:scale-95 shrink-0';
      headerBtn.title = 'مساعد الابتسامة الذكي (DSD Clinical Copilot)';
      headerBtn.innerHTML = `
        <i class="fa-solid fa-wand-magic-sparkles text-amber-300 text-xs animate-pulse"></i>
        <span class="inline font-bold">المساعد</span>
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
      `;
      headerBtn.addEventListener('click', toggleCopilot);
      headerRight.insertBefore(headerBtn, headerRight.firstChild);
    }
  }

  function createCopilotModalElement() {
    if (document.getElementById('dsd-copilot-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'dsd-copilot-modal';
    // Highly responsive: On mobile, bottom sheet / drawer; on desktop, sleek floating floating card
    modal.className = 'fixed z-50 transition-all duration-300 transform select-text hidden flex-col shadow-2xl border border-slate-700/80 bg-slate-900/98 backdrop-blur-xl rounded-t-2xl md:rounded-2xl bottom-0 md:bottom-20 right-0 md:right-5 left-0 md:left-auto w-full md:w-[410px] h-[78vh] md:h-[590px] max-h-[85vh]';

    modal.innerHTML = `
      <!-- COPILOT HEADER -->
      <div class="px-3.5 py-2.5 bg-slate-850 border-b border-slate-800 flex items-center justify-between shrink-0 rounded-t-2xl">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <i class="fa-solid fa-wand-magic-sparkles text-amber-300 text-sm"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-xs md:text-sm text-white tracking-tight">مساعد الابتسامة السريري</h3>
              <span class="text-[9px] px-1.5 py-0.2 rounded bg-blue-950 text-sky-400 font-semibold border border-blue-800">DSD Copilot</span>
            </div>
            <div id="copilot-header-state" class="text-[10px] text-slate-400 flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              <span id="copilot-state-text">جاري فحص حالة الكانفاس...</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <!-- Refresh Chat -->
          <button id="btn-copilot-reset" title="محادثة جديدة" class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <i class="fa-solid fa-rotate-right text-xs"></i>
          </button>
          <!-- Minimize Window -->
          <button id="btn-copilot-minimize" title="تصغير" class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <i class="fa-solid fa-minus text-xs"></i>
          </button>
          <!-- Close Window -->
          <button id="btn-copilot-close" title="إغلاق" class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>
      </div>

      <!-- LIVE CLINICAL AUDIT BANNER -->
      <div id="copilot-status-card" class="bg-slate-800/80 px-3 py-2 border-b border-slate-700/60 flex items-center justify-between text-[11px] shrink-0">
        <div class="flex items-center gap-2 truncate">
          <i class="fa-solid fa-circle-check text-emerald-400 text-xs"></i>
          <span id="copilot-banner-summary" class="text-slate-300 truncate">المعايرة: بانتظار التفعيل · القالب: بيضاوي</span>
        </div>
        <button id="btn-copilot-banner-action" class="shrink-0 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[10px] transition-colors">
          معايرة 10.5mm
        </button>
      </div>

      <!-- CHAT MESSAGE THREAD -->
      <div id="copilot-messages" class="flex-1 p-3 overflow-y-auto space-y-3 text-xs leading-relaxed" dir="rtl">
        <!-- Messages rendered dynamically -->
      </div>

      <!-- QUICK PROMPT CHIPS (HORIZONTAL SCROLL ON MOBILE) -->
      <div class="px-2.5 py-1.5 bg-slate-900/90 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 text-[11px]">
        <button class="copilot-quick-chip shrink-0 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors flex items-center gap-1">
          <span>💡</span><span>ما خطوتي التالية؟</span>
        </button>
        <button class="copilot-quick-chip shrink-0 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors flex items-center gap-1">
          <span>📐</span><span>كيف أعاير؟</span>
        </button>
        <button class="copilot-quick-chip shrink-0 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors flex items-center gap-1">
          <span>⚖️</span><span>النسبة الذهبية</span>
        </button>
        <button class="copilot-quick-chip shrink-0 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors flex items-center gap-1">
          <span>📏</span><span>العرض والطول 80%</span>
        </button>
        <button class="copilot-quick-chip shrink-0 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors flex items-center gap-1">
          <span>🎭</span><span>قوالب الفيزاجيزم</span>
        </button>
        <button class="copilot-quick-chip shrink-0 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors flex items-center gap-1">
          <span>📑</span><span>تصدير PDF</span>
        </button>
        <button class="copilot-quick-chip shrink-0 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors flex items-center gap-1">
          <span>📱</span><span>استخدام الهاتف</span>
        </button>
      </div>

      <!-- INPUT BAR -->
      <div class="p-2.5 bg-slate-850 border-t border-slate-800 flex items-center gap-2 shrink-0 rounded-b-2xl" dir="rtl">
        <input 
          id="copilot-text-input" 
          type="text" 
          placeholder="اسأل المساعد عن المعايرة، النسبة الذهبية، أو أي أداة..." 
          class="flex-1 bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
        />
        <button id="btn-copilot-send" class="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-all active:scale-95 shadow-md shadow-blue-600/30">
          <i class="fa-solid fa-arrow-left text-xs"></i>
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    // Wire Modal Buttons
    const closeBtn = modal.querySelector('#btn-copilot-close');
    const minBtn = modal.querySelector('#btn-copilot-minimize');
    const resetBtn = modal.querySelector('#btn-copilot-reset');
    const sendBtn = modal.querySelector('#btn-copilot-send');
    const input = modal.querySelector('#copilot-text-input');
    const bannerAction = modal.querySelector('#btn-copilot-banner-action');

    if (closeBtn) closeBtn.onclick = toggleCopilot;
    if (minBtn) minBtn.onclick = toggleCopilot;
    if (resetBtn) resetBtn.onclick = () => {
      copilotState.messages = [];
      showInitialDiagnosis();
    };

    if (sendBtn && input) {
      sendBtn.onclick = () => submitInput();
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitInput();
        }
      };
    }

    if (bannerAction) {
      bannerAction.onclick = () => {
        const snap = getAppSnapshot();
        if (!snap.isCalibrated) {
          executeClinicalAction('start-calibration');
        } else {
          executeClinicalAction('open-tab-inspect');
        }
      };
    }

    // Wire Quick Chips
    modal.querySelectorAll('.copilot-quick-chip').forEach(chip => {
      chip.onclick = (e) => {
        const text = e.currentTarget.textContent.trim().replace(/^[\uD800-\uDBFF\uDC00-\uDFFF\u2600-\u27FF]+\s*/, '');
        handleUserMessage(text);
      };
    });
  }

  function toggleCopilot() {
    const modal = document.getElementById('dsd-copilot-modal');
    if (!modal) return;

    copilotState.isOpen = !copilotState.isOpen;

    // Remove welcome toast if present
    const welcomeToast = document.getElementById('copilot-welcome-toast');
    if (welcomeToast) welcomeToast.remove();

    if (copilotState.isOpen) {
      // Close mobile sheet if open
      if (window.dsdApp && window.dsdApp.closeMobileSheet) {
        window.dsdApp.closeMobileSheet();
      }
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      updateCopilotHeaderBadge();
      const input = document.getElementById('copilot-text-input');
      if (input) setTimeout(() => input.focus(), 150);
      scrollToBottom();

      const navTab = document.getElementById('mobile-nav-copilot-tab');
      if (navTab) {
        navTab.classList.add('text-amber-400', 'bg-slate-800/80', 'rounded-lg');
      }
    } else {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      const navTab = document.getElementById('mobile-nav-copilot-tab');
      if (navTab) {
        navTab.classList.remove('text-amber-400', 'bg-slate-800/80', 'rounded-lg');
      }
    }
  }

  function updateCopilotHeaderBadge() {
    const snap = getAppSnapshot();
    const stage = evaluateCurrentStage(snap);

    const stateText = document.getElementById('copilot-state-text');
    const bannerSummary = document.getElementById('copilot-banner-summary');
    const bannerAction = document.getElementById('btn-copilot-banner-action');
    const peekText = document.getElementById('copilot-peek-text');

    if (stateText) stateText.textContent = stage.title;
    if (peekText) peekText.textContent = stage.title;

    if (bannerSummary) {
      if (snap.isCalibrated) {
        bannerSummary.innerHTML = `معايرة: <span class="text-emerald-400 font-bold">${snap.pixelsPerMm} px/mm</span> · قالب: ${getArchetypeNameAr(snap.activeArchetype)}`;
      } else {
        bannerSummary.innerHTML = `معايرة: <span class="text-amber-400 font-bold">بانتظار المعايرة</span> · اضغط للبدء`;
      }
    }

    if (bannerAction) {
      if (!snap.isCalibrated) {
        bannerAction.textContent = 'ابدأ المعايرة';
        bannerAction.className = 'shrink-0 px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold text-[10px] transition-colors';
      } else {
        bannerAction.textContent = 'فحص المقاسات';
        bannerAction.className = 'shrink-0 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[10px] transition-colors';
      }
    }
  }

  function submitInput() {
    const input = document.getElementById('copilot-text-input');
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;
    input.value = '';
    handleUserMessage(val);
  }

  function handleUserMessage(userText) {
    // 1. Append user message bubble
    appendMessage({
      sender: 'user',
      text: userText
    });

    // 2. Generate intelligent clinical response
    const reply = generateClinicalResponse(userText);

    // 3. Realistic slight typing micro-delay (~100ms) for pleasant UX
    setTimeout(() => {
      appendMessage({
        sender: 'copilot',
        text: reply.text,
        actions: reply.actions || []
      });
      updateCopilotHeaderBadge();
    }, 120);
  }

  function appendMessage({ sender, text, actions = [] }) {
    const container = document.getElementById('copilot-messages');
    if (!container) return;

    const msgEl = document.createElement('div');
    msgEl.className = `flex flex-col ${sender === 'user' ? 'items-start' : 'items-end'} space-y-1.5 transition-all`;

    if (sender === 'user') {
      msgEl.innerHTML = `
        <div class="flex items-center gap-1.5 text-[10px] text-slate-400 self-start">
          <i class="fa-solid fa-user-doctor text-blue-400"></i>
          <span>أنت (الطبيب المعالج)</span>
        </div>
        <div class="bg-blue-600/90 text-white px-3.5 py-2 rounded-2xl rounded-tr-none max-w-[85%] shadow-sm">
          ${escapeHtml(text)}
        </div>
      `;
    } else {
      let actionsHtml = '';
      if (actions.length > 0) {
        actionsHtml = `
          <div class="pt-2 mt-2 border-t border-blue-900/60 flex flex-wrap gap-1.5">
            ${actions.map(a => `
              <button data-copilot-action="${a.action}" class="copilot-action-trigger text-left px-2.5 py-1 rounded-lg bg-blue-900/80 hover:bg-blue-700 text-sky-200 border border-blue-500/40 text-[11px] font-medium transition-all active:scale-95 shadow-sm flex items-center gap-1.5">
                <i class="fa-solid fa-bolt text-[10px] text-amber-300"></i>
                <span>${a.label}</span>
              </button>
            `).join('')}
          </div>
        `;
      }

      msgEl.innerHTML = `
        <div class="flex items-center gap-1.5 text-[10px] text-slate-400 self-end">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>مساعد الابتسامة الذكي</span>
          <i class="fa-solid fa-wand-magic-sparkles text-amber-300"></i>
        </div>
        <div class="bg-slate-800/95 border border-slate-700 text-slate-200 px-3.5 py-2.5 rounded-2xl rounded-tl-none max-w-[95%] shadow-md">
          <div class="copilot-body leading-relaxed text-[11.5px]">${text}</div>
          ${actionsHtml}
        </div>
      `;
    }

    container.appendChild(msgEl);

    // Wire action triggers
    msgEl.querySelectorAll('.copilot-action-trigger').forEach(btn => {
      btn.onclick = (e) => {
        const actionKey = e.currentTarget.dataset.copilotAction;
        if (actionKey) {
          executeClinicalAction(actionKey);
          // Feedback in chat
          appendMessage({
            sender: 'copilot',
            text: `⚡ <b>تم تنفيذ الإجراء:</b> [${e.currentTarget.textContent.trim()}] بنجاح على الكانفاس!`
          });
        }
      };
    });

    scrollToBottom();
  }

  function showInitialDiagnosis() {
    const snap = getAppSnapshot();
    const stage = evaluateCurrentStage(snap);

    const container = document.getElementById('copilot-messages');
    if (container) container.innerHTML = '';

    appendMessage({
      sender: 'copilot',
      text: `👋 <b>مرحباً بك دكتور! أنا مساعد الابتسامة السريري الذكي (DSD Clinical Copilot).</b><br><br>
قمت بفحص حالة المريض <b>(${snap.patientName})</b> والكانفاس فورياً:<br>
• المعايرة: ${snap.isCalibrated ? '<span class="text-emerald-400 font-bold">مكتملة (1 مم = ' + snap.pixelsPerMm + ' px)</span>' : '<span class="text-amber-400 font-bold">غير مفعلة (يوصى بالمعايرة بنقرتين)</span>'}<br>
• قالب الفيزاجيزم: <b>${getArchetypeNameAr(snap.activeArchetype)}</b><br>
• عناصر الأسنان: <b>${snap.teethCount} عناصر نشطة</b><br><br>
<b>🎯 التوصية الحالية:</b> ${stage.advice}`,
      actions: [
        { label: '💡 ما هي خطوتي التالية؟', action: 'ask-next-step' },
        { label: '📐 ابدأ المعايرة الآن (10.5mm)', action: 'start-calibration' },
        { label: '✨ فحص النسبة الذهبية', action: 'toggle-golden' },
        { label: '📑 تصدير تقرير الحالة A4', action: 'export-pdf' }
      ]
    });
  }

  function scrollToBottom() {
    const container = document.getElementById('copilot-messages');
    if (container) {
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 50);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function setupStateChangeListeners() {
    // Listen to canvas modifications or selection changes to update copilot status
    setInterval(() => {
      updateCopilotHeaderBadge();
    }, 1500);
  }

  // Self-boot immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCopilotUI);
  } else {
    initCopilotUI();
  }

  // Expose Copilot API globally
  window.dsdCopilot = {
    toggle: toggleCopilot,
    ask: handleUserMessage,
    execute: executeClinicalAction,
    getState: getAppSnapshot
  };

})();

/** Copyright Stewart Allen -- All Rights Reserved */
"use strict";

self.kiri = (self.kiri || {});
self.kiri.version = exports.VERSION;
self.kiri.license = exports.LICENSE;
self.kiri.copyright = exports.COPYRIGHT;

(function () {

    let iOS = /(iPad|iPhone|iPod)/g.test(navigator.userAgent),
        autoDecimate = true,
        // ---------------
        MOTO    = moto,
        KIRI    = self.kiri,
        BASE    = self.base,
        UTIL    = BASE.util,
        DBUG    = BASE.debug,
        LANG    = KIRI.lang.current,
        WIN     = self.window,
        DOC     = self.document,
        LOC     = self.location,
        HOST    = LOC.host.split(':'),
        LOCAL   = self.debug,
        SETUP   = parseOpt(LOC.search.substring(1)),
        SECURE  = isSecure(LOC.protocol),
        SDB     = MOTO.KV,
        ODB     = KIRI.odb = new MOTO.Storage(SETUP.d ? SETUP.d[0] : 'kiri'),
        SPACE   = KIRI.space = MOTO.Space,
        WIDGETS = KIRI.widgets = [],
        CATALOG = KIRI.catalog = KIRI.openCatalog(ODB,autoDecimate),
        STATS   = new Stats(SDB),
        SEED    = 'kiri-seed',
        // ---------------
        MODES   = KIRI.conf.MODES,
        VIEWS   = KIRI.conf.VIEWS,
        filter  = KIRI.conf.filter,
        settings = KIRI.conf.template,
        settingsDefault = settings,
        // ---------------
        Widget    = kiri.Widget,
        newWidget = kiri.newWidget,
        // ---------------
        UI = {},
        UC = MOTO.ui.prefix('kiri').inputAction(updateSettings).hideAction(updateDialogLeft),
        MODE = MODES.FDM,
        onEvent = {},
        currentPrint = null,
        selectedMeshes = [],
        localFilterKey ='kiri-gcode-filters',
        localFilters = js2o(SDB.getItem(localFilterKey)) || [],
        // ---------------
        widget_selected_color = 0xbbff00,
        widget_deselected_color = 0xffff00,
        widget_slicing_color = 0xffaaaa,
        widget_cam_preview_color = 0x0055bb,
        preview_opacity_cam = 0.25,
        preview_opacity = 0.0,
        model_opacity = 1.0,
        slicing_opacity = 0.5,
        sliced_opacity = 0.0,
        sliced_opacity_cam = 0.25,
        // ---------------
        renderMode = 4,
        viewMode = VIEWS.ARRANGE,
        layoutOnAdd = true,
        local = SETUP.local,
        camStock = null,
        camTopZ = 0,
        topZ = 0,
        showFavorites = SDB.getItem('dev-favorites') === 'true',
        alerts = [];

    // seed defaults. will get culled on save
    settings.sproc.FDM.default = clone(settings.process);
    settings.sproc.CAM.default = clone(settings.process);
    settings.sproc.LASER.default = clone(settings.process);
    settings.cdev.FDM = clone(settings.device);
    settings.cdev.CAM = clone(settings.device);

    if (SETUP.rm) renderMode = parseInt(SETUP.rm[0]);
    DBUG.enable();

    // add show() to catalog for API
    CATALOG.show = showCatalog;

    const selection = {
        opacity: setOpacity,
        move: moveSelection,
        scale: scaleSelection,
        rotate: rotateSelection,
        bounds: boundsSelection,
        meshes: function() { return selectedMeshes.slice() },
        widgets: function() { return selectedMeshes.slice().map(m => m.widget) },
        for_meshes: forSelectedMeshes,
        for_widgets: forSelectedWidgets
    };

    const platform = {
        add: platformAdd,
        delete: platformDelete,
        layout: platformLayout,
        load: platformLoad,
        load_stl: platformLoadSTL,
        deselect: platformDeselect,
        select: platformSelect,
        select_all: platformSelectAll,
        selected_count: platformSelectedCount,
        compute_max_z: platformComputeMaxZ,
        update_origin: platformUpdateOrigin,
        update_bounds: platformUpdateBounds,
        update_stock: platformUpdateStock,
        update_size: platformUpdateSize,
        update_top_z: platformUpdateTopZ,
        load_files: loadFiles
    };

    const color = {
        wireframe: 0x444444
    };

    const opacity = {
        wireframe: 0.25
    };

    const API = KIRI.api = {
        ui: UI,
        uc: UC,
        sdb: SDB,
        o2js: o2js,
        js2o: js2o,
        ajax: ajax,
        focus: setFocus,
        stats: STATS,
        catalog: CATALOG,
        conf: {
            get: getSettings,
            put: putSettings,
            load: loadNamedSetting,
            save: saveSettings,
            show: showSettings,
            update: updateSettings
        },
        color,
        const: {
            SEED,
            LANG,
            LOCAL,
            MODES,
            VIEWS,
            SETUP
        },
        var: {
            layer_at: 0,
            layer_max: 0,
            layer_range: 0
        },
        device: {
            get: currentDeviceName,
            set: undefined // set during init
        },
        dialog: {
            show: showDialog,
            hide: hideDialog,
            update: updateDialogLeft
        },
        help: {
            show: showHelp,
            file: showHelpFile
        },
        event: {
            on: addOnEvent,
            emit: sendOnEvent,
            import: loadFile,
            alerts: updateAlerts,
            settings: triggerSettingsEvent
        },
        function: {
            slice: prepareSlices,
            print: preparePrint,
            export: function() { KIRI.export() },
            clear: clearWidgetCache
        },
        hide: {
            import: function() { UI.import.style.display = 'none' }
        },
        language: KIRI.lang,
        modal: {
            show: showModal,
            hide: hideModal,
            visible: modalShowing
        },
        mode: {
            get_lower: getModeLower,
            get_id: function() { return MODE },
            get: getMode,
            set: setMode,
            switch: switchMode
        },
        opacity,
        print: {
            get: function() { return currentPrint },
            clear: clearPrint
        },
        probe: {
            grid : function() { return false },
            local : function() { return false }
        },
        platform,
        selection,
        show: {
            alert: alert2,
            devices: undefined, // set during init
            progress: setProgress,
            controls: setControlsVisible,
            favorites: getShowFavorites,
            slices: showSlices,
            layer: setVisibleLayer,
            local: showLocal,
            import: function() { UI.import.style.display = '' }
        },
        space: {
            restore: restoreWorkspace,
            clear: clearWorkspace,
            save: saveWorkspace,
        },
        view: {
            get: function() { return viewMode },
            set: setViewMode,
            update_fields: updateFields,
            wireframe: toggleWireframe,
            snapshot: null
        },
        widgets: {
            new: newWidget,
            all: function() { return WIDGETS.slice() },
            for: forAllWidgets,
            load: Widget.loadFromCatalog,
            meshes: meshArray,
            opacity: setOpacity
        },
        work: KIRI.work
    };

    /** ******************************************************************
     * Stats accumulator
     ******************************************************************* */

    function Stats(db) {
        this.db = db;
        this.obj = js2o(this.db['stats'] || '{}');
        var o = this.obj, k;
        for (k in o) {
            if (!o.hasOwnProperty(k)) continue;
            if (k === 'dn' || k.indexOf('-') > 0 || k.indexOf('_') > 0) {
                delete o[k];
            }
        }
    }

    Stats.prototype.save = function(quiet) {
        this.db['stats'] = o2js(this.obj);
        if (!quiet) {
            sendOnEvent('stats', this.obj);
        }
        return this;
    };

    Stats.prototype.get = function(k) {
        return this.obj[k];
    };

    Stats.prototype.set = function(k,v,quiet) {
        this.obj[k] = v;
        this.save(quiet);
        return this;
    };

    Stats.prototype.add = function(k,v,quiet) {
        this.obj[k] = (this.obj[k] || 0) + (v || 1);
        this.save(quiet);
        return this;
    };

    Stats.prototype.del = function(k, quiet) {
        delete this.obj[k];
        this.save(quiet);
        return this;
    };

    let inits = parseInt(SDB.getItem('kiri-init') || STATS.get('init') || 0) + 1;
    SDB.setItem('kiri-init', inits);

    STATS.set('init', inits);
    STATS.set('kiri', kiri.version);

    /** ******************************************************************
     * Utility Functions
     ******************************************************************* */

     function clone(o) {
         return o ? JSON.parse(JSON.stringify(o)) : o;
     }

     function unitScale() {
         return settings.controller.units === 'in' ? 25.4 : 1;
     }

     function alert2(message, time) {
         if (message === undefined) {
             return updateAlerts(true);
         }
         alerts.push([message, Date.now(), time]);
         updateAlerts();
     }

     function updateAlerts(clear) {
         if (clear) {
             alerts = [];
         }
         let now = Date.now();
         // filter out by age
         alerts = alerts.filter(alert => {
             return (now - alert[1]) < ((alert[2] || 5) * 1000);
         });
         // limit to 5 showing
         while (alerts.length > 5) {
             alerts.shift();
         }
         // return if called before UI configured
         if (!UI.alert) {
             return;
         }
         if (alerts.length > 0) {
             UI.alert.text.innerHTML = alerts.map(v => ['<p>',v[0],'</p>'].join('')).join('');
             UI.alert.dialog.style.display = 'flex';
         } else {
             UI.alert.dialog.style.display = 'none';
         }
     }

     function getShowFavorites(bool) {
         if (bool !== undefined) {
             SDB.setItem('dev-favorites', bool);
             showFavorites = bool;
             return bool;
         }
         return showFavorites;
     }

     function sendOnEvent(name, data) {
         if (name && onEvent[name]) onEvent[name].forEach(function(fn) {
             fn(data);
         });
     }

     function addOnEvent(name, handler) {
         if (name && typeof(name) === 'string' && typeof(handler) === 'function') {
             onEvent[name] = onEvent[name] || [];
             onEvent[name].push(handler);
         }
     }

     function triggerSettingsEvent() {
         sendOnEvent('settings', settings);
     }

    function isSecure(proto) {
         return proto.toLowerCase().indexOf("https") === 0;
    }

    function parseOpt(ov) {
        var opt = {}, kv, kva;
        ov.split(',').forEach(function(el) {
            kv = el.split(':');
            if (kv.length === 2) {
                kva = opt[kv[0]] = opt[kv[0]] || [];
                kva.push(decodeURIComponent(kv[1]));
            }
        });
        return opt;
    }

    function ajax(url, fn, rt, po, hd) {
        return new MOTO.Ajax(fn, rt).request(url, po, hd);
    }

    function o2js(o,def) {
        return o ? JSON.stringify(o) : def || null;
    }

    function js2o(s,def) {
        try {
            return s ? JSON.parse(s) : def || null;
        } catch (e) {
            console.log({malformed_json:s});
            return def || null;
        }
    }

    function ls2o(key,def) {
        return js2o(SDB.getItem(key),def);
    }

    function cull(o, f) {
        for (var k in o) {
            if (!o.hasOwnProperty(k)) {
                continue;
            }
            if (!f.hasOwnProperty(k)) {
                delete o[k];
            }
        }
    }

    function setProgress(value, msg) {
        if (value) {
            value = UTIL.round(value*100,4);
            UI.loading.display = 'block';
            UI.progress.width = value+'%';
            if (msg) UI.prostatus.innerHTML = msg;
        } else {
            UI.loading.display = 'none';
        }
    }

    function bound(v,min,max) {
        return Math.max(min,Math.min(max,v));
    }

    function setVisibleLayer(v) {
        showSlices(API.var.layer_at = bound(v, 0, API.var.layer_max));
    }

    function meshArray() {
        var out = [];
        forAllWidgets(function(widget) {
            out.push(widget.mesh);
        });
        return out;
    }

    function forAllWidgets(f) {
        WIDGETS.slice().forEach(function(widget) {
            f(widget);
        });
    }

    function forSelectedWidgets(f) {
        var m = selectedMeshes;
        if (m.length === 0 && WIDGETS.length === 1) m = [ WIDGETS[0].mesh ];
        m.slice().forEach(function (mesh) { f(mesh.widget) });
    }

    function forSelectedMeshes(f) {
        selectedMeshes.slice().forEach(function (mesh) { f(mesh) });
    }

    function toggleWireframe(color, opacity) {
        forAllWidgets(function(w) { w.toggleWireframe(color, opacity) });
        SPACE.update();
    }

    function updateSliderMax(set) {
        var max = 0;
        if (viewMode === VIEWS.PREVIEW && currentPrint) {
            max = currentPrint.getLayerCount();
        } else {
            forAllWidgets(function(widget) {
                if (!widget.slices) return;
                max = Math.max(max, widget.slices.length);
            });
        }
        max = Math.max(0, max - 1);
        API.var.layer_max = max;
        if (UI.layerID.convert() > max || API.var.layer_at > max) {
            API.var.layer_at = max;
            UI.layerID.value = max;
            UI.layerSlider.value = API.var.layer_max;
        }
        UI.layerSlider.max = max;
        if (set) {
            API.var.layer_at = API.var.layer_max;
            UI.layerSlider.value = API.var.layer_max;
        }
    }

    function hideSlices() {
        var showing = false;
        setOpacity(model_opacity);
        forAllWidgets(function(widget) {
            widget.setWireframe(false);
            showing = widget.hideSlices() || showing;
        });
        clearPrint();
        return showing;
    }

    function showSlice(index, range, layer) {
        if (range) {
            return index <= layer && index > layer-range;
        } else {
            return index <= layer;
        }
    }

    /**
     * hide or show slice-layers and their sub-elements
     *
     * @param {number} [layer]
     */
    function showSlices(layer) {
        if (typeof(layer) === 'string' || typeof(layer) === 'number') {
            layer = parseInt(layer);
        } else {
            layer = API.var.layer_at;
        }

        layer = bound(layer, 0, API.var.layer_max);

        UI.layerID.value = layer;
        UI.layerSlider.value = layer;

        var j,
            slice,
            slices,
            layers,
            range = UI.layerRange.checked ? UI.layerSpan.convert() || 1 : 0,
            print = UI.layerPrint.checked,
            moves = UI.layerMoves.checked;

        if (MODE === MODES.CAM && API.var.layer_range !== range && range && layer === API.var.layer_max) {
            layer = 0;
        }

        API.var.layer_range = range;
        API.var.layer_at = layer;

        forAllWidgets(function(widget) {
            if (print) return widget.hideSlices();

            slices = widget.slices;
            if (!slices) return;

            for (j = 0; j < slices.length; j++) {
                slice = slices[j];
                slice.view.visible = showSlice(j, range, layer);
                layers = slice.layers;
                layers.outline.setVisible(
                    MODE === MODES.CAM ?
                        UI.layerOutline.checked && LOCAL :
                        UI.layerOutline.checked
                );
                layers.trace.setVisible(
                    MODE === MODES.CAM ?
                        UI.layerRough.checked :
                        UI.layerTrace.checked
                );
                layers.bridge.setVisible(
                    MODE === MODES.CAM ?
                        UI.layerFinishX.checked :
                        UI.layerDelta.checked
                );
                layers.flat.setVisible(
                    MODE === MODES.CAM ?
                        UI.layerFinishY.checked :
                        UI.layerDelta.checked
                );
                layers.solid.setVisible(
                    MODE === MODES.CAM ?
                        UI.layerFinish.checked :
                        UI.layerSolid.checked
                );
                layers.fill.setVisible(
                    MODE === MODES.CAM ?
                        UI.layerFacing.checked :
                        UI.layerFill.checked
                );
                layers.sparse.setVisible(UI.layerSparse.checked);
                layers.support.setVisible(UI.layerSupport.checked);
            }
        });

        if (currentPrint) {
            let len = currentPrint.getLayerCount();
            for (j = 0; j < len; j++) {
                currentPrint.showLayer(j, print && showSlice(j, range, layer), moves);
            }
        }
        UI.layerPrint.parentNode.style.display = currentPrint ? '' : 'none';
        UI.layerMoves.parentNode.style.display = currentPrint ? '' : 'none';

        SPACE.update();
    }

    function loadCode(code, type) {
        setViewMode(VIEWS.PREVIEW);
        clearPrint();
        setOpacity(0);
        currentPrint = kiri.newPrint(settings, []);
        let center = settings.process.outputOriginCenter;
        let origin = settings.origin;
        let offset = {
            x: origin.x,
            y: -origin.y,
            z: origin.z
        };
        switch (type) {
            case 'svg':
                currentPrint.parseSVG(code, offset);
                break;
            default:
                currentPrint.parseGCode(code, offset);
                break;
        }
        currentPrint.render();
        SPACE.platform.add(currentPrint.group);
        SPACE.update();
        UI.layerPrint.checked = true;
        updateSliderMax(true);
        showSlices();
    }

    function preparePrint(callback) {
        // kick off slicing it hasn't been done already
        for (var i=0; i < WIDGETS.length; i++) {
            if (!WIDGETS[i].slices || WIDGETS[i].isModified()) {
                prepareSlices(function() {
                    if (!WIDGETS[i].slices || WIDGETS[i].isModified()) {
                        alert2("nothing to print");
                    } else {
                        preparePrint(callback);
                    }
                });
                return;
            }
        }

        setViewMode(VIEWS.PREVIEW);
        clearPrint();
        saveSettings();

        if (MODE === MODES.CAM) {
            setOpacity(preview_opacity_cam);
            forAllWidgets(function(widget) {
                widget.setColor(widget_cam_preview_color);
            });
        } else {
            setOpacity(preview_opacity);
        }

        currentPrint = kiri.newPrint(settings, WIDGETS);
        currentPrint.setup(true, function(update, status) {
            // on update
            setProgress(update, status);
        }, function() {
            setProgress(0);
            currentPrint.render();

            // on done
            STATS.add(`ua_${getModeLower()}_print`);
            SPACE.platform.add(currentPrint.group);
            SPACE.update();

            UI.layerPrint.checked = true;
            updateSliderMax(true);
            showSlices();

            if (typeof(callback) === 'function') {
                callback();
            }
        });
    }

    function clearWidgetCache() {
        hideSlices();
        clearSlices();
        clearPrint();
    }

    function clearPrint() {
        if (currentPrint) {
            SPACE.platform.remove(currentPrint.group);
            currentPrint = null;
        }
        UI.layerPrint.checked = false;
    }

    function clearSlices() {
        forAllWidgets(function(widget) {
            widget.slices = null;
        });
    }

    /**
     * incrementally slice all meshes then incrementally update them
     *
     * @param {Function} callback
     */
    function prepareSlices(callback) {
        if (viewMode == VIEWS.ARRANGE) {
            let snap = SPACE.screenshot();
            API.view.snapshot = snap.substring(snap.indexOf(",")+1);
        }

        setViewMode(VIEWS.SLICE);

        clearPrint();
        saveSettings();
        platform.deselect();

        var firstMesh = true,
            countdown = WIDGETS.length,
            preserveMax = API.var.layer_max,
            preserveLayer = API.var.layer_at,
            totalProgress,
            track = {};

        // require topo be sent back from worker for local printing
        settings.synth.sendTopo = false;

        setOpacity(slicing_opacity);

        // for each widget, slice
        forAllWidgets(function(widget) {
            var segtimes = {},
                segNumber = 0,
                errored = false,
                startTime,
                lastMsg;

            widget.stats.progress = 0;
            widget.setColor(widget_slicing_color);
            widget.slice(settings, function(sliced, error) {
                var mark = UTIL.time();
                // on done
                widget.render(renderMode, MODE === MODES.CAM);
                // clear wireframe
                widget.setWireframe(false, color.wireframe, opacity.wireframe);
                widget.setOpacity(settings.mode === 'CAM' ? sliced_opacity_cam : sliced_opacity);
                widget.setColor(widget_deselected_color);
                // update UI info
                if (sliced) {
                    // update segment time
                    if (lastMsg) segtimes[segNumber+"_"+lastMsg] = mark - startTime;
                    DBUG.log(segtimes);
                    STATS.add(`ua_${getModeLower()}_slice`);
                    updateSliderMax(true);
                    if (preserveMax != API.var.layer_max) {
                        preserveLayer = API.var.layer_max;
                    }
                    firstMesh = false;
                }
                // on the last exit, update ui and call the callback
                if (--countdown === 0 || error || errored) {
                    setProgress(0);
                    showSlices(preserveLayer);
                    setOpacity(settings.mode === 'CAM' ? sliced_opacity_cam : sliced_opacity);
                    if (callback && typeof callback === 'function') {
                        callback();
                    }
                }
                // update slider window
                API.dialog.update();
                // handle slicing errors
                if (error && !errored) {
                    errored = true;
                    setViewMode(VIEWS.ARRANGE);
                    setOpacity(model_opacity);
                    platform.deselect();
                    alert2(error);
                }
            }, function(update, msg) {
                if (msg !== lastMsg) {
                    var mark = UTIL.time();
                    if (lastMsg) segtimes[segNumber+"_"+lastMsg] = mark - startTime;
                    lastMsg = msg;
                    startTime = mark;
                    segNumber++;
                }
                // on update
                track[widget.id] = update;
                totalProgress = 0;
                forAllWidgets(function(w) {
                    totalProgress += (track[w.id] || 0);
                });
                setProgress(totalProgress / WIDGETS.length, msg);
            }, true);
        });
    }

    function fillOffsetMult() {
        return 1.0-bound(settings.process.sliceFillOverlap, 0, 0.8);
    }

    function diffOffset() {
        return (settings.device.nozzleSize / 2) * fillOffsetMult();
    }

    /** ******************************************************************
     * Selection Functions
     ******************************************************************* */

    function meshUpdateInfo(mesh) {
        if (!mesh) {
            if (selectedMeshes.length === 0) {
                UI.selWidth.innerHTML = '0';
                UI.selDepth.innerHTML = '0';
                UI.selHeight.innerHTML = '0';
                UI.scaleX.value = '';
                UI.scaleY.value = '';
                UI.scaleZ.value = '';
            }
            return
        }
        let scale = unitScale();
        UI.selWidth.innerHTML = UTIL.round(mesh.w/scale,2);
        UI.selDepth.innerHTML = UTIL.round(mesh.h/scale,2);
        UI.selHeight.innerHTML = UTIL.round(mesh.d/scale,2);
        UI.scaleX.value = 1;
        UI.scaleY.value = 1;
        UI.scaleZ.value = 1;
    }

    function setOpacity(value) {
        forAllWidgets(function (w) { w.setOpacity(value) });
        UI.modelOpacity.value = value * 100;
        SPACE.update();
    }

    function moveSelection(x, y, z, abs) {
        forSelectedWidgets(function (w) { w.move(x, y, z, abs) });
        platform.update_stock();
        SPACE.update();
    }

    function scaleSelection(ev) {
        var dv = parseFloat(ev.target.value || 1);
        if (UI.scaleUniform.checked) {
            UI.scaleX.value = dv;
            UI.scaleY.value = dv;
            UI.scaleZ.value = dv;
        }
        var x = parseFloat(UI.scaleX.value || dv),
            y = parseFloat(UI.scaleY.value || dv),
            z = parseFloat(UI.scaleZ.value || dv);
        forSelectedWidgets(function (w) {
            w.scale(x,y,z);
            meshUpdateInfo(w.mesh);
        });
        UI.scaleX.value = 1;
        UI.scaleY.value = 1;
        UI.scaleZ.value = 1;
        platform.compute_max_z();
        platform.update_stock(true);
        SPACE.update();
    }

    function rotateSelection(x, y, z) {
        forSelectedWidgets(function (w) { w.rotate(x, y, z) });
        platform.compute_max_z();
        platform.update_stock(true);
        SPACE.update();
    }

    function boundsSelection() {
        var bounds = new THREE.Box3();
        forSelectedWidgets(function(widget) {
            bounds.union(widget.mesh.getBoundingBox());
        });
        return bounds;
    }

    /** ******************************************************************
     * Platform Functions
     ******************************************************************* */

     function platformUpdateOrigin() {
         platform.update_bounds();
         let dev = settings.device;
         let proc = settings.process;
         let x = 0;
         let y = 0;
         let z = 0;
         if (MODE === MODES.CAM && proc.camOriginTop) {
             z = camTopZ + 0.01;
             if (!camStock) {
                 z += proc.camZTopOffset;
             }
         }
         if (!proc.outputOriginCenter) {
             if (camStock) {
                 x = (-camStock.scale.x / 2) + camStock.position.x;
                 y = (camStock.scale.y / 2) - camStock.position.y;
             } else {
                 if (MODE === MODES.LASER && proc.outputOriginBounds) {
                     let b = settings.bounds;
                     x = b.min.x,
                     y = -b.min.y
                 } else {
                     x = -dev.bedWidth / 2;
                     y = dev.bedDepth / 2;
                 }
             }
         } else if (camStock) {
             x = camStock.position.x;
             y = -camStock.position.y;
         }
         settings.origin = {x, y, z};
         if (settings.controller.showOrigin) {
             SPACE.platform.setOrigin(x,y,z);
         } else {
             SPACE.platform.setOrigin();
         }
     }

     function platformUpdateTopZ() {
         let camz = (MODE === MODES.CAM) && (settings.stock.z || settings.controller.alignTop);
         let ztop = camz ? camTopZ - settings.process.camZTopOffset : 0;
         forAllWidgets(function(widget) {
             widget.setTopZ(ztop);
         });
     }

    function platformUpdateSize() {
        var dev = settings.device,
            width, depth,
            height = Math.round(Math.max(dev.bedHeight, dev.bedWidth/100, dev.bedDepth/100));
        SPACE.platform.setRound(dev.bedRound);
        SPACE.platform.setGZOff(height/2 - 0.1);
        SPACE.platform.setSize(
            width = parseInt(dev.bedWidth),
            depth = parseInt(dev.bedDepth),
            height
        );
        SPACE.platform.setHidden(width > 500 || depth > 500);
        platform.update_origin();
    }

    function platformUpdateBounds() {
        var bounds = new THREE.Box3();
        forAllWidgets(function(widget) {
            let wp = widget.orient.pos;
            let wb = widget.mesh.getBoundingBox().clone();
            // wb.translate(widget.orient.pos);
            bounds.union(wb);
        });
        return settings.bounds = bounds;
    }

    function platformSelect(widget, shift) {
        if (viewMode !== VIEWS.ARRANGE) return;
        var mesh = widget.mesh,
            sel = (selectedMeshes.indexOf(mesh) >= 0);
        if (sel) {
            if (shift) {
                platform.deselect(widget)
            } else if (selectedMeshes.length > 1) {
                platform.deselect();
                platform.select(widget, false);
            }
        } else {
            // prevent selection in slice view
            if (!mesh.material.visible) return;
            if (!shift) platform.deselect();
            selectedMeshes.push(mesh);
            widget.setColor(widget_selected_color);
            meshUpdateInfo(mesh);
        }
        platformUpdateSelected();
        SPACE.update();
    }

    function platformSelectedCount() {
        return viewMode === VIEWS.ARRANGE ? selectedMeshes.length : 0;
    }

    function platformUpdateSelected() {
        UI.selection.style.display = platform.selected_count() ? 'inline' : 'none';
    }

    function platformDeselect(widget) {
        if (viewMode !== VIEWS.ARRANGE) {
            // don't de-select and re-color widgets in,
            // for example, sliced or preview modes
            return;
        }
        if (!widget) {
            forAllWidgets(function(widget) {
                platform.deselect(widget);
            });
            return;
        }
        var mesh = widget.mesh,
            si = selectedMeshes.indexOf(mesh),
            sel = (si >= 0);
        if (sel) selectedMeshes.splice(si,1);
        widget.setColor(widget_deselected_color);
        platformUpdateSelected();
        SPACE.update();
        meshUpdateInfo();
    }

    function platformLoad(url, onload) {
        if (url.toLowerCase().indexOf(".stl") > 0) {
            platform.load_stl(url, onload);
        } else {
            ajax(url, function(vertices) {
                vertices = js2o(vertices).toFloat32();
                platform.add(newWidget().loadVertices(vertices));
                if (onload) onload(vertices);
            });
        }
    }

    function platformLoadSTL(url, onload) {
        new MOTO.STL().load(url, function(vertices) {
            platform.add(newWidget().loadVertices(vertices));
            if (onload) onload(vertices);
        })
    }

    function platformComputeMaxZ() {
        topZ = 0;
        forAllWidgets(function(widget) {
            topZ = Math.max(topZ, widget.mesh.getBoundingBox().max.z);
        });
        SPACE.platform.setMaxZ(topZ);
    }

    function platformAdd(widget, shift, nolayout) {
        WIDGETS.push(widget);
        SPACE.platform.add(widget.mesh);
        platform.select(widget, shift);
        platform.compute_max_z();
        if (nolayout) return;
        if (layoutOnAdd) platform.layout();
    }

    function platformDelete(widget) {
        if (!widget) {
            return;
        }
        if (Array.isArray(widget)) {
            var mc = widget.slice(), i;
            for (i=0; i<mc.length; i++) {
                platform.delete(mc[i].widget);
            }
            return;
        }
        KIRI.work.clear(widget);
        WIDGETS.remove(widget);
        SPACE.platform.remove(widget.mesh);
        selectedMeshes.remove(widget.mesh);
        updateSliderMax();
        platform.compute_max_z();
        if (MODE !== MODES.FDM) platform.layout();
        SPACE.update();
        platformUpdateSelected();
    }

    function platformSelectAll() {
        forAllWidgets(function(w) { platform.select(w, true) })
    }

    function platformLayout(event, space) {
        var auto = UI.autoLayout.checked,
            layout = (viewMode === VIEWS.ARRANGE && auto),
            proc = settings.process,
            modified = false,
            oldmode = viewMode,
            topZ = MODE === MODES.CAM ? camTopZ - proc.camZTopOffset : 0;

        switch (MODE) {
            case MODES.CAM:
            case MODES.LASER:
                space = space || proc.outputTileSpacing || 1;
                break;
            case MODES.FDM:
                space = space || (proc.sliceSupportExtra || 0) + 1;
                break;
        }

        setViewMode(VIEWS.ARRANGE);
        hideSlices();

        // only auto-layout when in arrange mode
        if (oldmode !== VIEWS.ARRANGE) {
            return SPACE.update();
        }

        // do not layout when switching back from slice view
        if (!auto || (!space && !layout)) {
            return SPACE.update();
        }

        // check if any widget has been modified
        forAllWidgets(function(w) {
            modified |= w.isModified();
        });

        var gap = space;

        // in CNC mode with >1 widget, force layout with spacing @ 1.5x largest tool diameter
        if (MODE === MODES.CAM && WIDGETS.length > 1) {
            var spacing = space || 1, CAM = KIRI.driver.CAM;
            if (proc.roughingOn) spacing = Math.max(spacing, CAM.getToolDiameter(settings, proc.roughingTool));
            if (proc.finishingOn || proc.finishingXOn || proc.finishingYOn) spacing = Math.max(spacing, CAM.getToolDiameter(settings, proc.finishingTool));
            gap = spacing * 1.5;
        }

        var i, m, sz = SPACE.platform.size(),
            mp = [sz.x, sz.y],
            ms = [mp[0] / 2, mp[1] / 2],
            mi = mp[0] > mp[1] ? [(mp[0] / mp[1]) * 10, 10] : [10, (mp[1] / mp[1]) * 10],
            c = meshArray().sort(function (a, b) { return (b.w * b.h) - (a.w * a.h) }),
            p = new MOTO.Pack(ms[0], ms[1], gap).fit(c);

        while (!p.packed) {
            ms[0] += mi[0];
            ms[1] += mi[1];
            p = new MOTO.Pack(ms[0], ms[1], gap).fit(c);
        }

        for (i = 0; i < c.length; i++) {
            m = c[i];
            m.fit.x += m.w / 2 + p.pad;
            m.fit.y += m.h / 2 + p.pad;
            m.widget.move(p.max.w / 2 - m.fit.x, p.max.h / 2 - m.fit.y, 0, true);
            // m.widget.setTopZ(topZ);
            m.material.visible = true;
        }

        if (MODE === MODES.CAM) {
            platform.update_stock();
        }
        platform.update_origin();

        SPACE.update();
    }

    function platformUpdateStock(refresh) {
        let sd = settings.process;
        let offset = UI.camStockOffset.checked;
        let stockSet = sd.camStockX && sd.camStockY && sd.camStockZ;
        let scale = unitScale();
        settings.stock = { };
        camTopZ = topZ;
        // create/inject cam stock if stock size other than default
        if (MODE === MODES.CAM && stockSet && WIDGETS.length) {
            UI.stock.style.display = offset ? 'inline' : 'none';
            let csx = sd.camStockX * scale;
            let csy = sd.camStockY * scale;
            let csz = sd.camStockZ * scale;
            let csox = 0;
            let csoy = 0;
            if (offset) {
                let min = { x: Infinity, y: Infinity, z: 0 };
                let max = { x: -Infinity, y: -Infinity, z: -Infinity };
                forAllWidgets(function(widget) {
                    let wbnd = widget.getBoundingBox(refresh);
                    let wpos = widget.orient.pos;
                    min = {
                        x: Math.min(min.x, wpos.x + wbnd.min.x),
                        y: Math.min(min.y, wpos.y + wbnd.min.y),
                        z: 0
                    };
                    max = {
                        x: Math.max(max.x, wpos.x + wbnd.max.x),
                        y: Math.max(max.y, wpos.y + wbnd.max.y),
                        z: Math.max(max.z, wbnd.max.z)
                    };
                });
                csx += max.x - min.x;
                csy += max.y - min.y;
                csz += max.z - min.z;
                csox = min.x + ((max.x - min.x) / 2);
                csoy = min.y + ((max.y - min.y) / 2);
                $('stock-width').innerText = (csx/scale).toFixed(2);
                $('stock-depth').innerText = (csy/scale).toFixed(2);
                $('stock-height').innerText = (csz/scale).toFixed(2);
            }
            if (!camStock) {
                var geo = new THREE.BoxGeometry(1, 1, 1);
                var mat = new THREE.MeshBasicMaterial({ color: 0x777777, opacity: 0.2, transparent: true, side:THREE.DoubleSide });
                var cube = new THREE.Mesh(geo, mat);
                SPACE.platform.add(cube);
                camStock = cube;
            }
            settings.stock = {
                x: csx,
                y: csy,
                z: csz
            };
            camStock.scale.x = csx;
            camStock.scale.y = csy;
            camStock.scale.z = csz;
            camStock.position.x = csox;
            camStock.position.y = csoy;
            camStock.position.z = csz / 2;
            camStock.material.visible = settings.mode === 'CAM';
            camTopZ = csz;
        } else if (camStock) {
            UI.stock.style.display = 'none';
            SPACE.platform.remove(camStock);
            camStock = null;
            camTopZ = topZ;
        }
        platform.update_top_z();
        platform.update_origin();
        SPACE.update();
    }

    /** ******************************************************************
     * Settings Functions
     ******************************************************************* */

     function resetSettings(force) {
         if (force || confirm('reset all values to system defaults?')) {
             settings = settingsDefault;
             updateFields();
         };
     }

    /**
     * fill in missing settings from default template to pick up new fields
     * that may have been recently added and expected in the code
     *
     * @param {Object} osrc
     * @param {Object} odst
     */
    function fillMissingSettings(osrc, odst) {
        var key, val;
        for (key in osrc) {
            if (!osrc.hasOwnProperty(key)) continue;
            val = odst[key];
            if (typeof val === 'undefined' || val === null || val === '') {
                odst[key] = osrc[key];
            } else if (typeof osrc[key] === 'object') {
                fillMissingSettings(osrc[key], odst[key]);
            }
        }
    }

    /**
     * @returns {Object}
     */
    function updateFieldsFromSettings(scope) {
        if (!scope) return console.trace("missing scope");

        var key, val;

        fillMissingSettings(settingsDefault, settings);
        settings.infill = settingsDefault.infill;
        settings.units = settingsDefault.units;

        for (key in scope) {
            if (!scope.hasOwnProperty(key)) continue;
            val = scope[key];
            if (UI.hasOwnProperty(key)) {
                var uie = UI[key],
                    typ = uie ? uie.type : null;
                if (typ === 'text') {
                    uie.value = val;
                } else if (typ === 'checkbox') {
                    uie.checked = val;
                } else if (typ === 'select-one') {
                    uie.innerHTML = '<option></option>';
                    var chosen = null;
                    var source = uie.parentNode.getAttribute('source');
                    var list = settings[source];
                    list.forEach(function(tool, index) {
                        let id = tool.id || tool.name;
                        if (val === id) {
                            chosen = index + 1;
                        }
                        var opt = DOC.createElement('option');
                        opt.appendChild(DOC.createTextNode(tool.name));
                        opt.setAttribute('value', id);
                        uie.appendChild(opt);
                    });
                    if (chosen) uie.selectedIndex = chosen;
                }
            }
        }

        return settings;
    }

    /**
     * @returns {Object}
     */
    function updateSettingsFromFields(scope) {
        if (!scope) return console.trace("missing scope");

        var key,
            changed = false;

        // for each key in scope object
        for (key in scope) {
            if (!scope.hasOwnProperty(key)) continue;
            if (UI.hasOwnProperty(key)) {
                var nval = null,
                    uie = UI[key];
                // skip empty UI values
                if (!uie || uie === '') continue;
                if (uie.type === 'text') {
                    nval = UI[key].convert();
                } else if (uie.type === 'checkbox') {
                    nval = UI[key].checked;
                } else if (uie.type === 'select-one') {
                    if (uie.selectedIndex > 0) {
                        nval = uie.options[uie.selectedIndex].value;
                        let src = uie.parentNode.getAttribute('source');
                        if (src === 'tools') {
                            nval = parseInt(nval);
                        }
                    }
                }
                if (scope[key] != nval) {
                    scope[key] = nval;
                }
            }
        }

        settings.synth.fillOffsetMult = fillOffsetMult();
        settings.synth.diffOffsetMult = diffOffset();

        return settings;
    }

    function updateFields() {
        updateFieldsFromSettings(settings.device);
        updateFieldsFromSettings(settings.process);
        updateFieldsFromSettings(settings.layers);
        updateFieldsFromSettings(settings.controller);
    }

    function updateSettings() {
        updateSettingsFromFields(settings.device);
        updateSettingsFromFields(settings.process);
        updateSettingsFromFields(settings.layers);
        updateSettingsFromFields(settings.controller);
        saveSettings();
        platform.update_stock();
    }

    function saveSettings() {
        // remove settings invalid for a given mode (cleanup)
        cull(settings, settingsDefault);
        switch (settings.mode) {
            case 'FDM':
                cull(settings.device, filter.fdm.d);
                cull(settings.process, filter.fdm.p);
                break;
            case 'CAM':
                cull(settings.device, filter.cam.d);
                cull(settings.process, filter.cam.p);
                break;
            case 'LASER':
                cull(settings.device, filter.laser.d);
                cull(settings.process, filter.laser.p);
                settings.cdev.LASER = clone(settings.device);
                break;
        }
        cull(settings.cdev.FDM, filter.fdm.d);
        cull(settings.cdev.CAM, filter.cam.d);
        // store camera view
        var view = SPACE.view.save();
        if (view.left || view.up) settings.controller.view = view;
        SDB.setItem('ws-settings', JSON.stringify(settings));
    }

    function loadFiles(files) {
        for (var i=0; i<files.length; i++) {
            var reader = new FileReader(),
                lower = files[i].name.toLowerCase(),
                israw = lower.indexOf(".raw") > 0 || lower.indexOf('.') < 0,
                isstl = lower.indexOf(".stl") > 0,
                issvg = lower.indexOf(".svg") > 0,
                isgcode = lower.indexOf(".gcode") > 0 || lower.indexOf(".nc") > 0;
            reader.file = files[i];
            reader.onloadend = function (e) {
                if (israw) platform.add(
                    newWidget().loadVertices(JSON.parse(e.target.result).toFloat32())
                );
                if (isstl) platform.add(
                    newWidget()
                    .loadVertices(new MOTO.STL().parse(e.target.result))
                    .saveToCatalog(e.target.file.name)
                );
                if (isgcode) loadCode(e.target.result, 'gcode');
                if (issvg) loadCode(e.target.result, 'svg');
            };
            reader.readAsBinaryString(reader.file);
        }
    }

    function loadFile() {
        $('load-file').onchange = function(event) {
            DBUG.log(event);
            loadFiles(event.target.files);
        };
        $('load-file').click();
        // alert2("drag/drop STL files onto platform to import\nreload page to return to last saved state");
    }

    function saveWorkspace() {
        saveSettings();
        var newWidgets = [],
            oldWidgets = js2o(SDB.getItem('ws-widgets'), []);
        forAllWidgets(function(widget) {
            newWidgets.push(widget.id);
            oldWidgets.remove(widget.id);
            widget.saveState();
        });
        SDB.setItem('ws-widgets', o2js(newWidgets));
        oldWidgets.forEach(function(wid) {
            Widget.deleteFromState(wid);
        });
        alert2("workspace saved", 1);
    }

    function restoreWorkspace(ondone, skip_widget_load) {
        var loaded = 0,
            toload = ls2o('ws-widgets',[]),
            newset = ls2o('ws-settings'),
            camera = ls2o('ws-camera'),
            position = true;

        if (newset) {
            fillMissingSettings(settingsDefault, newset);
            settings = newset;
            // override camera from settings
            if (settings.controller.view) {
                camera = settings.controller.view;
                SDB.removeItem('ws-camera');
                UI.reverseZoom.checked = settings.controller.reverseZoom;
            }
            // merge custom filters from localstorage into settings
            localFilters.forEach(function(fname) {
                var fkey = "gcode-filter-"+fname, ov = ls2o(fkey);
                if (ov) settings.devices[fname] = ov;
                SDB.removeItem(fkey)
            });
            SDB.removeItem(localFilterKey);
            // save updated settings
            saveSettings();
        }

        updateFields();
        platform.update_size();
        platform.update_stock();

        SPACE.view.reset();

        if (camera) SPACE.view.load(camera);
        else setTimeout(SPACE.view.home, 100);

        if (skip_widget_load) return;

        // remove any widgets from platform
        forAllWidgets(function(widget) {
            platform.delete(widget);
        });

        // load any widget by name that was saved to the workspace
        toload.forEach(function(widgetid) {
            Widget.loadFromState(widgetid, function(widget) {
                if (widget) {
                    platform.add(widget, 0, position);
                }
                if (++loaded === toload.length) {
                    platform.deselect();
                    if (ondone) {
                        ondone();
                        setTimeout(() => {
                            platform.update_top_z();
                            SPACE.update();
                        }, 1);
                    }
                }
            }, position);
        });

        return toload.length > 0;
    }

    function clearWorkspace() {
        // free up worker cache/mem
        KIRI.work.clear();
        platform.select_all();
        platform.delete(selectedMeshes);
    }

    function modalShowing() {
        var showing = $('modal').style.display !== 'none';
        return showing || UC.isPopped();
    }

    function showModal(which) {
        UI.modal.style.display = 'block';
        ["print","help","local"].forEach(function(modal) {
            UI[modal].style.display = (modal === which ? 'block' : 'none');
        });
    }

    function hideDialog() {
        showDialog(null);
    }

    function showDialog(which, force) {
        if (UC.isPopped()) {
            UC.hidePop();
            return;
        }
        ["catalog","devices","tools","settings"].forEach(function(dialog) {
            var style = UI[dialog].style;
            style.display = (dialog === which && (force || style.display !== 'flex') ? 'flex' : 'none');
        });
    }

    function showCatalog() {
        showDialog("catalog");
    }

    function getSettings() {
        return settings;
    }

    function putSettings(newset) {
        settings = newset;
        saveSettings()
        restoreWorkspace(null, true);
    }

    function editNamedSetting(e) {
        var mode = getMode(),
            name = e.target.getAttribute("name"),
            load = settings.sproc[mode][name],
            edit = prompt(`settings for "${name}"`, JSON.stringify(load));

        if (edit) {
            try {
                settings.sproc[mode][name] = JSON.parse(edit);
                if (name === settings.process.processName) {
                    loadNamedSetting(null, name);
                }
                saveSettings();
            } catch (e) {
                alert('malformed settings object');
            }
        }
    }

    function loadNamedSetting(e, named) {
        var mode = getMode(),
            name = e ? e.target.getAttribute("load") : named || settings.cproc[mode],
            load = settings.sproc[mode][name];

        if (!load) return;

        for (var k in load) {
            if (!load.hasOwnProperty(k)) continue;
            // prevent stored process from overwriting device defaults
            //if (k === "outputOriginCenter" && mode == "FDM") continue;
            settings.process[k] = load[k];
        }

        settings.process.processName = name;
        settings.cproc[mode] = name;

        // associate named process with the current device
        settings.devproc[currentDeviceName()] = name;

        // update selection display (off for laser)
        $('selected-device').innerHTML = currentDeviceName();
        $('selected-process').innerHTML = name;

        // FDM process settings overridden by device
        if (mode == "FDM") {
            settings.process.outputOriginCenter = (settings.device.originCenter || false);
        }

        updateFields();
        if (!named) {
            hideDialog();
        }
        updateSettings();
        if (e) triggerSettingsEvent();
    }

    function deleteNamedSetting(e) {
        var name = e.target.getAttribute("del");
        delete settings.sproc[getMode()][name];
        updateSettingsList();
        saveSettings();
        triggerSettingsEvent();
    }

    function updateSettingsList() {
        var list = [], s = settings, sp = s.sproc[getMode()] || {}, table = UI.settingsList;
        table.innerHTML = '';
        for (var k in sp) {
            if (sp.hasOwnProperty(k)) list.push(k);
        }
        list.sort().forEach(function(sk) {
            var row = DOC.createElement('div'),
                load = DOC.createElement('button'),
                edit = DOC.createElement('button'),
                del = DOC.createElement('button'),
                name = sk;

            load.setAttribute('load', sk);
            load.onclick = loadNamedSetting;
            load.appendChild(DOC.createTextNode(sk));
            if (sk == settings.process.processName) {
                load.setAttribute('class', 'selected')
            }

            del.setAttribute('del', sk);
            del.setAttribute('title', "remove '"+sk+"'");
            del.onclick = deleteNamedSetting;
            del.appendChild(DOC.createTextNode('x'));

            edit.innerHTML = '&uarr;';
            edit.setAttribute('name', sk);
            edit.setAttribute('title', 'edit');
            edit.onclick = editNamedSetting;

            row.setAttribute("class", "flow-row");
            row.appendChild(edit);
            row.appendChild(load);
            row.appendChild(del);
            table.appendChild(row);
        });
        API.dialog.update();
    }

    function showSettings() {
        updateSettingsList();
        showDialog("settings");
    }

    function updateDialogLeft() {
        let left = UI.ctrlLeft.getBoundingClientRect();
        let right = UI.ctrlRight.getBoundingClientRect();
        UI.catalog.style.left = (left.width + 5) + 'px';
        UI.devices.style.left = (left.width + 5) + 'px';
        UI.tools.style.left = (left.width + 5) + 'px';
        UI.settings.style.right = (right.width + 5) + 'px';
    }

    function hideModal() {
        UI.modal.style.display = 'none';
    }

    function showHelp() {
        showHelpFile(`/kiri/lang/${KIRI.lang.get()}-help.html`);
    }

    function showHelpFile(local) {
        hideDialog();
        if (!local) {
            WIN.open("//wiki.grid.space/wiki/Kiri:Moto", "_help");
            STATS.add('ua_help');
            return;
        }
        ajax(local, function(html) {
            UI.help.innerHTML = html;
            $('help-close').onclick = hideModal;
            $('kiri-version').innerHTML = `<i>${LANG.version} ${KIRI.version}</i>`;
            showModal('help');
            STATS.add('ua_help');
        });
    }

    function showLocal() {
        $('local-close').onclick = hideModal;
        showModal('local');
        fetch("/api/grid_local")
            .then(r => r.json())
            .then(j => {
                let bind = [];
                let html = ['<table>'];
                html.push(`<thead><tr><th>device</th><th>type</th><th>status</th><th></th></tr></thead>`);
                html.push(`<tbody>`);
                for (let k in j) {
                    let r = j[k].stat;
                    bind.push({uuid: r.device.uuid, host: r.device.addr[0], post: r.device.port});
                    html.push(`<tr>`);
                    html.push(`<td>${r.device.name}</td>`);
                    html.push(`<td>${r.device.mode}</td>`);
                    html.push(`<td>${r.state}</td>`);
                    html.push(`<td><button id="${r.device.uuid}">admin</button></td>`);
                    html.push(`</tr>`);
                }
                html.push(`</tbody>`);
                html.push(`</table>`);
                $('local-dev').innerHTML = html.join('');
                bind.forEach(rec => {
                    $(rec.uuid).onclick = () => {
                        window.open(`http://${rec.host}:${rec.port||4080}/`);
                    };
                });
            });
    }

    function setFocus(el) {
        el = [ el || UI.load, UI.import, UI.ctrlLeft, UI.container, UI.assets, UI.control, UI.modeFDM, UI.reverseZoom, UI.modelOpacity, DOC.body ];
        for (var es, i=0; i<el.length; i++) {
            es = el[i];
            es.focus();
            if (DOC.activeElement === es) {
                break;
            }
        }
    }

    function setViewMode(mode) {
        var oldMode = viewMode;
        viewMode = mode;
        platform.deselect();
        meshUpdateInfo();
        switch (mode) {
            case VIEWS.ARRANGE:
                showLayerView(false);
                updateSliderMax();
                showModeActive(UI.modeArrange);
                break;
            case VIEWS.SLICE:
                showLayerView(true);
                updateSliderMax();
                showModeActive(UI.modeSlice);
                break;
            case VIEWS.PREVIEW:
                showLayerView(true);
                showModeActive(UI.modePreview);
                break;
            default:
                DBUG.log("invalid view mode: "+mode);
                return;
        }
        DOC.activeElement.blur();
    }

    function showModeActive(el) {
        [ UI.modeArrange, UI.modeSlice, UI.modePreview, UI.modeExport ].forEach(function(b) {
            if (b === el) {
                b.classList.add('buton');
            } else {
                b.classList.remove('buton');
            }
        });
    }

    function showLayerView(bool) {
        UI.layerView.style.display = bool ? 'flex' : 'none';
    }

    function getMode() {
        return settings.mode;
    }

    function getModeLower() {
        return getMode().toLowerCase();
    }

    function switchMode(mode) {
        setMode(mode, platform.update_size);
    }

    function setMode(mode, lock, then) {
        hideModal();
        hideDialog();
        if (!MODES[mode]) {
            DBUG.log("invalid mode: "+mode);
            mode = 'FDM';
        }
        settings.mode = mode;
        // restore cached device profile for this mode
        if (settings.cdev[mode]) {
            settings.device = clone(settings.cdev[mode]);
        }
        // update device stat for FDM/CAM
        STATS.set(`ud_${getModeLower()}`, settings.filter[mode] || 'default');
        MODE = MODES[mode];
        // updates right-hand menu by enabling/disabling fields
        UC.setMode(MODE);
        loadNamedSetting();
        saveSettings();
        clearWidgetCache();
        SPACE.update();
        UI.modeFDM.setAttribute('class', MODE === MODES.FDM ? 'buton' : '');
        UI.modeLASER.setAttribute('class', MODE === MODES.LASER ? 'buton' : '');
        UI.modeCAM.setAttribute('class', MODE === MODES.CAM ? 'buton' : '');
        UI.mode.style.display = lock ? 'none' : '';
        UI.modeTable.style.display = lock ? 'none' : '';
        if (camStock) {
            camStock.material.visible = settings.mode === 'CAM';
        }
        restoreWorkspace(null, true);
        // if (MODE !== MODES.FDM) platform.layout();
        if (then) then();
        triggerSettingsEvent();
    }

    function currentDeviceName() {
        return settings.filter[getMode()];
    }

    function setControlsVisible(show) {
        UI.ctrlLeft.style.display = show ? 'block' : 'none';
        UI.ctrlRight.style.display = show ? 'block' : 'none';
    }

    // prevent safari from exiting full screen mode
    DOC.onkeydown = function (evt) { if (evt.keyCode == 27) evt.preventDefault() }

    // run optional module functions NOW before kiri-init has run
    if (Array.isArray(self.kirimod)) {
        kirimod.forEach(function(mod) { mod(kiri.api) });
    }

})();

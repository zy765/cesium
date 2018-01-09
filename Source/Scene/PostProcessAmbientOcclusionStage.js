define([
        '../Core/Check',
        '../Core/defined',
        '../Core/defineProperties',
        '../Core/destroyObject',
        '../Core/PixelFormat',
        '../Renderer/PixelDatatype',
        '../Renderer/Sampler',
        '../Renderer/Texture',
        '../Renderer/TextureMagnificationFilter',
        '../Renderer/TextureMinificationFilter',
        '../Renderer/TextureWrap',
        '../Shaders/PostProcessFilters/AmbientOcclusion',
        '../Shaders/PostProcessFilters/AmbientOcclusionGenerate',
        './PostProcess',
        './PostProcessBlurStage',
        './PostProcessComposite'
    ], function(
        Check,
        defined,
        defineProperties,
        destroyObject,
        PixelFormat,
        PixelDatatype,
        Sampler,
        Texture,
        TextureMagnificationFilter,
        TextureMinificationFilter,
        TextureWrap,
        AmbientOcclusion,
        AmbientOcclusionGenerate,
        PostProcess,
        PostProcessBlurStage,
        PostProcessComposite) {
    'use strict';

    /**
     * Post process stage for ambient occlusion. Implements {@link PostProcess}.
     *
     * @alias PostProcessAmbientOcclusionStage
     * @constructor
     *
     * @private
     */
    function PostProcessAmbientOcclusionStage() {
        this._name = 'czm_ambient_occlusion';
        this._randomTexture = undefined;

        var that = this;
        this._generatePostProcess = new PostProcess({
            name : 'czm_ambient_occlusion_generate',
            fragmentShader : AmbientOcclusionGenerate,
            uniformValues : {
                intensity : 4.0,
                bias : 0.0,
                lengthCap : 0.25,
                stepSize : 2.0,
                frustumLength : 1000.0,
                randomTexture : function () {
                    return that._randomTexture;
                }
            }
        });
        this._blurPostProcess = new PostProcessBlurStage({
            name : 'czm_ambient_occlusion_blur'
        });
        this._compositeProcess = new PostProcessComposite({
            name : 'czm_ambient_occlusion_generate_blur',
            processes : [this._generatePostProcess, this._blurPostProcess]
        });

        this._ambientOcclusionComposite = new PostProcess({
            name : 'czm_ambient_occlusion_composite',
            fragmentShader : AmbientOcclusion,
            uniformValues : {
                ambientOcclusionOnly : false,
                ambientOcclusionTexture : this._blurPostProcess.name
            }
        });

        this._uniformValues = {};
        defineProperties(this._uniformValues, {
            ambientOcclusionOnly : {
                get : function() {
                    return that._ambientOcclusionComposite.uniformValues.ambientOcclusionOnly;
                },
                set : function(value) {
                    that._ambientOcclusionComposite.uniformValues.ambientOcclusionOnly = value;
                }
            }
        });

        // used by PostProcessCollection
        this._collection = undefined;
        this._index = undefined;
    }

    defineProperties(PostProcessAmbientOcclusionStage.prototype, {
        ready : {
            get : function() {
                return this._compositeProcess.ready && this._ambientOcclusionComposite.ready;
            }
        },
        enabled : {
            get : function() {
                return this._compositeProcess.enabled;
            },
            set : function(value) {
                this._compositeProcess.enabled = this._ambientOcclusionComposite.enabled = value;
            }
        },
        name : {
            get : function() {
                return this._name;
            }
        },
        uniformValues : {
            get : function() {
                return this._uniformValues;
            }
        },
        generateUniformValues : {
            get : function() {
                return this._generatePostProcess.uniformValues;
            }
        },
        blurUniformValues : {
            get : function() {
                return this._blurPostProcess.uniformValues;
            }
        },
        outputTexture : {
            get : function() {
                return this._ambientOcclusionComposite.outputTexture;
            }
        },
        length : {
            get : function() {
                return 3;
            }
        }
    });

    PostProcessAmbientOcclusionStage.prototype.get = function(index) {
        //>>includeStart('debug', pragmas.debug);
        Check.typeOf.number.greaterThanOrEquals('index', index, 0);
        Check.typeOf.number.lessThan('index', index, this.length);
        //>>includeEnd('debug');
        if (index === 2) {
            return this._ambientOcclusionComposite;
        }
        return this._compositeProcess.get(index);
    };

    PostProcessAmbientOcclusionStage.prototype.update = function(context) {
        if (defined(this._randomTexture) && !this.enabled) {
            this._randomTexture.destroy();
            this._randomTexture = undefined;
        }

        if (!defined(this._randomTexture) && this.enabled) {
            var length = 256 * 256 * 3;
            var random = new Uint8Array(length);
            for (var i = 0; i < length; i += 3) {
                random[i] = Math.floor(Math.random() * 255.0);
            }

            this._randomTexture = new Texture({
                context : context,
                pixelFormat : PixelFormat.RGB,
                pixelDatatype : PixelDatatype.UNSIGNED_BYTE,
                source : {
                    arrayBufferView : random,
                    width : 256,
                    height : 256
                },
                sampler : new Sampler({
                    wrapS : TextureWrap.CLAMP_TO_EDGE,
                    wrapT : TextureWrap.CLAMP_TO_EDGE,
                    minificationFilter : TextureMinificationFilter.NEAREST,
                    magnificationFilter : TextureMagnificationFilter.NEAREST
                })
            });
        }

        this._compositeProcess.update(context);
        this._ambientOcclusionComposite.update(context);
    };

    PostProcessAmbientOcclusionStage.prototype.execute = function(context, colorTexture, depthTexture) {
        this._compositeProcess.execute(context, colorTexture, depthTexture);
        this._ambientOcclusionComposite.execute(context, colorTexture, depthTexture);
    };

    PostProcessAmbientOcclusionStage.prototype.isDestroyed = function() {
        return false;
    };

    PostProcessAmbientOcclusionStage.prototype.destroy = function() {
        this._compositeProcess.destroy();
        this._ambientOcclusionComposite.destroy();
        this._randomTexture = this._randomTexture && this._randomTexture.destroy();
        return destroyObject(this);
    };

    return PostProcessAmbientOcclusionStage;
});
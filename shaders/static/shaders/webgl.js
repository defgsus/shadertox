
//var defaultVertexShader = "void main() { glFragCoord"

function getGlContext(canvas) {
    if (typeof(canvas) === "string") {
        canvas = $(canvas).get()[0];
    }
    ctx = {
        canvas: canvas,
        texSlots: [null, null, null, null],
        tickId: 0,
        playing: false,
        playTime: 0,
        playStartTime: 0,
        framesPerSecond: 0,
        lastFrameTime: 0,
        log: function(x) { if (ctx.edit) ctx.edit.log(x); console.log(x); },
        error: function(x) { if (ctx.edit) ctx.edit.error(x); console.log("ERROR:", x); }
    };
    try
    {
        ctx.gl = canvas.getContext("experimental-webgl");
        ctx.gl.viewportWidth = canvas.width;
        ctx.gl.viewportHeight = canvas.height;
    }
    catch(e)
    {
        console.log(e);
    }
    if (!ctx.gl)
    {
        ctx.error("Could not initialize WebGL");
        return ctx;
    }

    ctx.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    ctx.gl.disable(ctx.gl.DEPTH_TEST);
    ctx.gl.viewport(0, 0, ctx.gl.viewportWidth, ctx.gl.viewportHeight);
    ctx.gl.clear(ctx.gl.COLOR_BUFFER_BIT | ctx.gl.DEPTH_BUFFER_BIT);

    ctx.compileShader = function(shaderType, source) {
        var shader = ctx.gl.createShader(shaderType);
        ctx.gl.shaderSource(shader, source);
	    ctx.gl.compileShader(shader);

        if (!ctx.gl.getShaderParameter(shader, ctx.gl.COMPILE_STATUS))
        {
            var log = ctx.gl.getShaderInfoLog(shader);
            ctx.error(log);
            if (ctx.edit)
                ctx.edit.parseLog(log);
            return null;
    	}

    	return shader;
    }

    ctx.createVertexBuffer = function(vertices, indices) {
		// ---- position ----
		// create buffer space
		var vb_pos = ctx.gl.createBuffer();
		ctx.gl.bindBuffer(ctx.gl.ARRAY_BUFFER, vb_pos);
		// upload data
		ctx.gl.bufferData(ctx.gl.ARRAY_BUFFER, new Float32Array(vertices), ctx.gl.STATIC_DRAW);
		// remember size
		vb_pos.itemSize = 3;
		vb_pos.numItems = vertices.length / 3;

		// ---- indices ----
		vb_index = ctx.gl.createBuffer();
		ctx.gl.bindBuffer(ctx.gl.ELEMENT_ARRAY_BUFFER, vb_index);
		ctx.gl.bufferData(ctx.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), ctx.gl.STATIC_DRAW);
		vb_index.itemSize = 1;
		vb_index.numItems = indices.length;

		ctx.vb_pos = vb_pos;
		ctx.vb_index = vb_index;
    }

    ctx.initShader = function(vertexSource, fragmentSource)
    {
        // compile and link
        ctx.vertexShader = ctx.compileShader(ctx.gl.VERTEX_SHADER, vertexSource);
        if (!ctx.vertexShader)
            return;
        ctx.fragmentShader = ctx.compileShader(ctx.gl.FRAGMENT_SHADER, fragmentSource);
        if (!ctx.fragmentShader)
            return;

        ctx.shaderProgram = ctx.gl.createProgram();
        ctx.gl.attachShader(ctx.shaderProgram, ctx.vertexShader);
        ctx.gl.attachShader(ctx.shaderProgram, ctx.fragmentShader);
        ctx.gl.linkProgram(ctx.shaderProgram);
    
        // check for success
        if (!ctx.gl.getProgramParameter(ctx.shaderProgram, ctx.gl.LINK_STATUS)) {
            ctx.error("Could not initialize shaders");
            return;
        }
    
        // bind shader
        ctx.gl.useProgram(this.shaderProgram);
        
        // bind attributes
        ctx.a_position = ctx.gl.getAttribLocation(ctx.shaderProgram, "a_position");
        if (ctx.a_position < 0)
            ctx.error("Could not find vertex attribute");
        ctx.gl.enableVertexAttribArray(ctx.shaderProgram.a_position);
        
        // bind uniforms
        ctx.u_time = ctx.gl.getUniformLocation(ctx.shaderProgram, "iTime");
        ctx.u_resolution = ctx.gl.getUniformLocation(ctx.shaderProgram, "iResolution");

        // bind texture slots
        for (var i=0; i<4; ++i) {
            var utex = ctx.gl.getUniformLocation(ctx.shaderProgram, "iChannel"+i);
            if (utex >= 0)
                ctx.gl.uniform1i(utex, i);
            ctx["u_texture"+i] = utex;
        }

        // "two triangles to render worlds"
        ctx.createVertexBuffer(
            [-1,-1,0, 1,-1,0, 1,1,0, -1,1,0],
            [0,1,2, 0,2,3]
        )
    }

    ctx.render = function() {
    	// bind buffers
		ctx.gl.bindBuffer(ctx.gl.ARRAY_BUFFER, ctx.vb_pos);
		ctx.gl.vertexAttribPointer(ctx.a_position, ctx.vb_pos.itemSize, ctx.gl.FLOAT, false, 0, 0);
		ctx.gl.bindBuffer(ctx.gl.ELEMENT_ARRAY_BUFFER, ctx.vb_index);

		// bind shader
		ctx.gl.useProgram(ctx.shaderProgram);
		
		// send uniforms
		ctx.gl.uniform1f(ctx.u_time, ctx.playTime);
		ctx.gl.uniform2f(ctx.u_resolution, ctx.gl.viewportWidth, ctx.gl.viewportHeight);

		// bind textures
		for (var i=0; i<4; ++i) {
		    if (ctx.texSlots[i] && ctx.texSlots[i].ready) {
		        ctx.gl.activeTexture(ctx.gl.TEXTURE0 + i);
		        ctx.gl.bindTexture(ctx.gl.TEXTURE_2D, ctx.texSlots[i].tex);
		    }
		}

		// draw
		ctx.gl.drawElements(ctx.gl.TRIANGLES, ctx.vb_index.numItems, ctx.gl.UNSIGNED_SHORT, 0);
	}

	ctx.initFromJson = function(data) {
	    var prev_playing = ctx.playing;
	    if (ctx.playing)
            ctx.stop();

	    var stage = data.stages[0];

	    var vertex_sources = data.sources.filter(function(e) { return e.type=="vertex" && e.stage==stage.index});
        if (vertex_sources.length != 1) {
	        ctx.error("Invalid vertex sources")
	        return;
        }

	    var frag_sources = data.sources.filter(function(e) { return e.type=="fragment" && e.stage==stage.index});
        if (frag_sources.length != 1) {
	        ctx.error("Invalid fragment sources")
	        return;
        }

        if (!stage.fragment_pre.endsWith("\n"))
            stage.fragment_pre += "\n";
	    var full_frag = stage.fragment_pre + frag_sources[0].source
        ctx.initShader(vertex_sources[0].source, full_frag);

        if (prev_playing)
            ctx.play();
        else
            ctx.updateRenderInfo();
	}

	ctx.stop = function(do_wait) {
	    if (!ctx.playing)
	        ctx.setPlayTime(0.);
	    ctx.playing = false;
	    ctx.updateRenderInfo();
	}
	ctx.play = function() {
	    ctx.playing = true;
	    ctx.setPlayTime(ctx.playTime);
	    ctx.updateRenderInfo();
	    ctx.tickId += 1;
	    ctx.tick(ctx.tickId);
	}
	ctx.togglePlaying = function() {
	    if (ctx.playing) ctx.stop(); else ctx.play();
	}
	ctx.setPlayTime = function(time) {
	    var now = Date.now();
	    ctx.playStartTime = now - time * 1000.;
	    ctx.playTime = time;
	    if (!ctx.playing)
	        ctx.updateRenderInfo();
	}

	ctx.updateRenderInfo = function() {
	    $("#play-button").text(ctx.playing ? '#' : '▶');
	    $("#play-time").text(ctx.playTime.toFixed(2));
	    $("#frames-per-second").text(ctx.framesPerSecond.toFixed());
	    if (ctx.playing) {
	        setTimeout(ctx.updateRenderInfo, 100);
	    }
	}

    ctx.tick = function(tickId) {
        /* tickId helps avoid having multiple parallel requestAnimFrames */
        if (ctx.playing && tickId == ctx.tickId) {
    		window.requestAnimFrame(function() { ctx.tick(tickId); });
	    	var time = Date.now();
            ctx.playTime = (time - ctx.playStartTime) / 1000.;
		    ctx.render();
            ctx.framesPerSecond = 1000. / Math.max(1., time - ctx.lastFrameTime);
            ctx.lastFrameTime = time;
		}
    };

    ctx.loadTexture = function(slot_num, url, doInterpol)
    {
        var slot = {
            tex: ctx.gl.createTexture(),
            image: new Image(),
            ready: false,
            doInterpol: doInterpol,
        }
        slot.image.onload = function() {
            ctx.handleTextureLoaded(slot_num);
        }
        slot.image.src = url;
        ctx.texSlots[slot_num] = slot;
        return slot;
    }
    
    ctx.handleTextureLoaded = function(slot_num)
    {
        var slot = ctx.texSlots[slot_num];
        ctx.gl.bindTexture(ctx.gl.TEXTURE_2D, slot.tex);
        ctx.gl.texImage2D(ctx.gl.TEXTURE_2D, 0, ctx.gl.RGBA, ctx.gl.RGBA, ctx.gl.UNSIGNED_BYTE,
                          slot.image);
        ctx.gl.texParameteri(ctx.gl.TEXTURE_2D, ctx.gl.TEXTURE_MAG_FILTER,
                             slot.doInterpol ? ctx.gl.LINEAR : ctx.gl.NEAREST);
        ctx.gl.texParameteri(ctx.gl.TEXTURE_2D, ctx.gl.TEXTURE_MIN_FILTER,
                             slot.doInterpol ? ctx.gl.LINEAR_MIPMAP_LINEAR : ctx.gl.NEAREST);
        if (slot.doInterpol) {
            ctx.gl.generateMipmap(ctx.gl.TEXTURE_2D);
        }
        ctx.log("texture slot " + slot_num + " loaded");
        slot.ready = true;
        //ctx.gl.bindTexture(ctx.gl.TEXTURE_2D, null);
        ctx.render();
    }

    ctx.getPixels = function() {
        var pixels = new Uint8Array(ctx.gl.viewportWidth * ctx.gl.viewportHeight * 4);
        ctx.gl.readPixels(0, 0, ctx.gl.viewportWidth, ctx.gl.viewportHeight,
                          ctx.gl.RGBA, ctx.gl.UNSIGNED_BYTE, pixels);
        console.log(pixels);
        return pixels;
    }

    return ctx;
};


/**
 * Provides requestAnimationFrame in a cross browser way.
 * https://gist.github.com/mrdoob/838785
 */
window.requestAnimFrame = (function() {
  return window.requestAnimationFrame ||
         window.webkitRequestAnimationFrame ||
         window.mozRequestAnimationFrame ||
         window.oRequestAnimationFrame ||
         window.msRequestAnimationFrame ||
         function(callback, element) {
             window.setTimeout(callback, 1000/60);
         };
})();





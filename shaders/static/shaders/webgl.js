
//var defaultVertexShader = "void main() { glFragCoord"

function getGlContext(canvas) {
    if (typeof(canvas) === "string") {
        canvas = $(canvas).get()[0];
    }
    ctx = {
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
        ctx.playing = false;
        ctx.updateRenderInfo();

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
        if (!ctx.gl.getProgramParameter(ctx.shaderProgram, ctx.gl.LINK_STATUS)) 
        {
            alert("Could not initialize shaders");
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

		// draw
		ctx.gl.drawElements(ctx.gl.TRIANGLES, ctx.vb_index.numItems, ctx.gl.UNSIGNED_SHORT, 0);
	}

	ctx.initFromJson = function(data) {
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
	}

	ctx.stop = function() { ctx.playing = false; ctx.updateRenderInfo(); }
	ctx.play = function() { ctx.playing = true; ctx.playStartTime = Date.now(); ctx.updateRenderInfo(); ctx.tick(); }

	ctx.togglePlaying = function() {
	    if (ctx.playing) ctx.stop(); else ctx.play();
	}

	ctx.updateRenderInfo = function() {
	    $("#play-button").text(ctx.playing ? '#' : '▶');
	    $("#play-time").text(ctx.playTime.toFixed(2));
	    $("#frames-per-second").text(ctx.framesPerSecond.toFixed());
	    if (ctx.playing) {
	        setTimeout(ctx.updateRenderInfo, 100);
	    }
	}

    ctx.tick = function() {
        if (ctx.playing) {
    		window.requestAnimFrame(ctx.tick);
	    	var time = Date.now();
            ctx.playTime = (time - ctx.playStartTime) / 1000.;
		    ctx.render();
            ctx.framesPerSecond = 1000. / Math.max(0.1, time - ctx.lastFrameTime);
            ctx.lastFrameTime = time;
		}
    };

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
         function(/* function FrameRequestCallback */ callback, /* DOMElement Element */ element) {
           window.setTimeout(callback, 1000/60);
         };
})();





// just copy/pasted, NOT INTEGRATED YET

function loadTexture(url, doInterpol)
{
	var tex = gl.createTexture();
	var img = new Image();
	img.onload = function() { handleTextureLoaded(img, tex, doInterpol); }
	img.src = url;
	return tex;
}

function handleTextureLoaded(image, texture, doInterp) 
{
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, doInterp ? gl.LINEAR : gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, doInterp ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST);
	if (doInterp) {
		gl.generateMipmap(gl.TEXTURE_2D);
	}
	gl.bindTexture(gl.TEXTURE_2D, null);
}



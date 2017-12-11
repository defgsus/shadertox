

function getEditorFromJson(data, ctx) {
    var html = "";

    var _log = function(x, err) {
        var text = x;
        if (typeof(x) != "string")
            text = JSON.stringify(x);
        if (!err)
            $("#code-editor-log").append("<p>"+text+"</p>");
        else
            $("#code-editor-log").append('<p class="error">'+text+"</p>");
    }

    var ed = {
        ctx: ctx,
        data: data,
        currentSourceId: null,
        lineWidgets: [],
        log: function(x) { _log(x, false); },
        error: function(x) { _log(x, true); }
    }
    ctx.edit = ed;

    ed.getSource = function() {
        return ed.editor.getValue();
    }

    ed.setSource = function(source) {
        ed.currentSourceId = source.id;
        ed.editor.setValue(source.source);
        $("#code-editor-header").html("stage " + ed.data.stages[source.stage].name);
    };

    ed.findSource = function(stage, name) {
        var srcs = ed.data.sources.filter(function(s) { return s.stage==stage && s.name==name; });
        return srcs.length == 1 ? srcs[0] : null;
    };

    ed.currentStage = function() {
        var stage_idx = 0;
        for (var i in ed.data.sources) {
            if (ed.data.sources[i].id == ed.currentSourceId) {
                stage_idx = ed.data.sources[i].stage;
                break;
            }
        }
        for (var i in ed.data.stages) {
            if (ed.data.stages[i].index == stage_idx) {
                return ed.data.stages[i];
            }
        }
        return null;
    }

    ed.storeSource = function() {
        // store source of current tab
        if (!ed.currentSourceId)
            return;
        for (var i in ed.data.sources) {
            if (ed.data.sources[i].id == ed.currentSourceId) {
                ed.data.sources[i].source = ed.editor.getValue();
                break;
            }
        }
        // also store other editable values
        ed.data.name = $("#shader-name").text();
        ed.data.description = $("#shader-description").html();
    };

    ed.compile = function() {
        ed.storeSource();
        ed.clearMarks();
        if (ed.checkIncludes())
            return;
        ed.ctx.initFromJson(ed.data);
        ed.ctx.render();
    };

    ed.parseLog = function(logtxt) {
        var lines = logtxt.split("\n")
        for (var li in lines) {
            var line = lines[li];
            if (line.startsWith("ERROR:")) {
                var poss = line.substr(6).split(":");
                var line_num = parseInt(poss[1]);
                line_num = line_num || 0;
                ed.markLine(line_num, 0, poss.slice(2).join(":").trim());
            }
        }
    }

    ed.checkIncludes = function() {
        var source = ed.getSource();
        var includes = Tools.getIncludes(source);
        var widgets = [];
        for (var i in includes) {
            // see if local include and not exists - then create creation-button
            if (!includes[i].shader) {
                var srcs = ed.data.sources.filter(function(s) { return s.name==includes[i].name; });
                if (!srcs.length) {
                    var widget = $('<div>create "' + includes[i].name + '"</div>');
                    widget.addClass("line-button");
                    widget.attr("data-create-include", includes[i].name);
                    widgets.push([includes[i].line, widget[0]]);
                }
            } else {
                // get include from other shader
                Tools.ajax(
                    ed.data.urls.find_include,
                    { shader: includes[i].shader, name: includes[i].name }
                )
                .done(function(data) {
                    ed.storeSource();
                    ed.data.sources.push(data.source);
                    ed.update();
                })
                .fail(function(e) {
                    ed.ctx.error(e);
                });
            }
        }
        if (widgets.length) {
            ed.clearMarks();
            for (var i in widgets) {
                ed.lineWidgets.push( ed.editor.addLineWidget(widgets[i][0], widgets[i][1]) );
            }
        }

        // create new include tab/source
        $('.line-button[data-create-include]').off("click").on("click", function(e) {
            var name = $(e.currentTarget).attr("data-create-include");
            ed.storeSource();
            var stage = ed.currentStage();
            if (stage) {
                $.ajax(ed.data.urls.new_source_id)
                .done(function(data) {
                    ed.data.sources.push({
                        id: data.id,
                        name: name,
                        type: "include",
                        stage: stage.index,
                        source: "/* " + name + " */"
                    });
                    ed.update();
                });
            }
        });
        return widgets.length > 0;
    }

    ed.markLine = function(line_num, char_num, text) {
        var line = $('<div></div>');
        line.addClass("code-line-error")
        if (char_num)
            line.html("&nbsp;".repeat(char_num) + "^<br/>" + text);
        else
            line.text(text);
        ed.lineWidgets.push( ed.editor.addLineWidget(line_num, line[0]) );
    }

    ed.clearMarks = function() {
        while (ed.lineWidgets && ed.lineWidgets.length) {
            ed.lineWidgets.pop().clear();
        }
    }

    ed.save = function() {
        ed.storeSource();
        Tools.post(ed.data.urls.save, ed.data)
        .done(function(data) {
            if (data.error)
                ed.ctx.error(data.error);
            else
                ed.ctx.log(data.message);
        })
        .fail(function(e) {
            ed.ctx.error(e);
        });
    }

    ed.update = function() {
        // build TABs
        data.sources.sort(function(l, r) { return l.stage < r.stage; })
        var html = "";
        for (var i in data.sources) {
            var src = data.sources[i];
            if (src.type != "vertex") {
                html += '<div class="code-editor-tab" data-id="'+ src.id +'">'
                        + src.name + '</div>';
            }
        }
        $("#code-editor-tab-header").html(html);

        // tab click event
        $(".code-editor-tab").on("click", function(e) {
            ed.storeSource();
            var $e = $(e.currentTarget);
            var source_id = $e.attr("data-id");
            srcs = ed.data.sources.filter(function(e){return e.id==source_id; });
            if (srcs.length==1) {
                $(".code-editor-tab").removeClass("code-editor-tab-active");
                ed.setSource(srcs[0]);
                $e.addClass("code-editor-tab-active");
            }
        });

        // buttons

        $("#compile-button").off("click").on("click", function() {
            ed.compile();
        });

        $("#save-button").off("click").on("click", function() {
            ed.save();
        });

        if (!ed.editor) {
            ed.editor = CodeMirror.fromTextArea($("#code-mirror").get()[0], {
                mode: "clike-glsl",
                theme: "xq-dark",
                lineNumbers: true
            });
            ed.editor.on("keyHandled", function(e, name, event) {
                if (name == "Enter")
                    ed.checkIncludes();
            });
        }

        var cursrc = ed.findSource(data.stages.length-1, "main");
        if (!cursrc)
            cursrc = data.sources[0];

        ed.currentSourceId = cursrc.id;
        ed.setSource(cursrc);
        $('.code-editor-tab[data-id="'+cursrc.id+'"]').addClass("code-editor-tab-active");
    }

    ed.update();

    return ed;
}
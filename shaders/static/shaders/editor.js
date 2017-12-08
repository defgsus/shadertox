

function getEditorFromJson(data, ctx) {
    var html = "";

    var _log = function(x) {
        var text = x;
        if (typeof(x) != "string")
            text = JSON.stringify(x);
        $("#code-editor-log").append("<p>"+text+"</p>");
    }

    var ed = {
        ctx: ctx,
        data: data,
        currentSourceId: null,
        lineWidgets: [],
        log: function(x) { _log(x); },
        error: function(x) { _log(x); }
    }
    ctx.edit = ed;

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
        if (!ed.currentSourceId)
            return;
        for (var i in ed.data.sources) {
            if (ed.data.sources[i].id == ed.currentSourceId) {
                ed.data.sources[i].source = ed.editor.getValue();
                break;
            }
        }
    };

    ed.compile = function() {
        ed.storeSource();
        ed.clearMarks();
        ed.ctx.initFromJson(ed.data);
        ed.ctx.render();
    };

    ed.parseLog = function(logtxt) {
        // find current stage and it's fragment_pre's number-of-lines
        var lines_pre = 0,
            cur_stage = ed.currentStage();
        if (cur_stage)
            lines_pre = cur_stage.fragment_pre.match(/\n/g).length + 1;

        var lines = logtxt.split("\n")
        for (var li in lines) {
            var line = lines[li];
            if (line.startsWith("ERROR:")) {
                var poss = line.substr(6).split(":");
                var line_num = parseInt(poss[1]) - lines_pre;
                ed.markLine(line_num, 0, poss.slice(2).join(":").trim());
            }
        }
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
        $.ajax({
            method: "POST",
            url: ed.data.urls.save,
            data: JSON.stringify(ed.data),
            headers: {
                "X-CSRFToken": $("[name=csrfmiddlewaretoken]").val()
            },
            contentType: 'application/json; charset=utf-8',
            dataType: 'text'
        })
        .done(function(e) {
            var data = JSON.parse(e);
            if (data.error)
                ed.ctx.error(data.error);
            else
                ed.ctx.log(data.message);
        })
        .fail(function(e) {
            ed.ctx.error(e);
        });
    }

    // build TABs
    data.sources.sort(function(l, r) { return l.stage < r.stage; })
    for (var i in data.sources) {
        var src = data.sources[i];
        if (src.id) {
            html += '<div class="code-editor-tab" data-id="'+ src.id +'">'
                    + src.name + '</div>';
        }
    }
    $("#code-editor-tab-header").html(html);

    // tab click event
    $(".code-editor-tab").on("click", function(e) {
        var $e = $(e.currentTarget);
        $(".code-editor-tab").removeClass("code-editor-tab-active");

        var source_id = $e.attr("data-id");
        srcs = ed.data.sources.filter(function(e){return e.id==source_id; });
        if (srcs.length==1) {
            ed.setSource(srcs[0]);
            $e.addClass("code-editor-tab-active");
        }
    });

    // buttons

    $("#compile-button").on("click", function() {
        ed.compile();
    });

    $("#save-button").on("click", function() {
        ed.save();
    });

    ed.editor = CodeMirror.fromTextArea($("#code-mirror").get()[0], {
        mode: "clike-glsl",
        theme: "xq-dark",
        lineNumbers: true
    });

    var cursrc = ed.findSource(data.stages.length-1, "main");
    if (!cursrc)
        cursrc = data.sources[0];

    ed.currentSourceId = cursrc.id;
    $('.code-editor-tab[data-id="'+cursrc.id+'"]').click();
    //ed.setCode(cursrc.source);

    return ed;
}
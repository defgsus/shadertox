# -*- coding: utf-8 -*-
from __future__ import unicode_literals

import random

from django.db import models, OperationalError
from django.utils.translation import ugettext_lazy as _
from django.urls import reverse
from django.db import transaction

from .models import *


JSON_LAYOUT = {
    "id": "10 alphanums",
    "name": "freely chooseable",
    "forks": ["10 alphanums",],
    "stages": [
        {
            "id": "10 alphanums",
            "name": "freely chooseable",
            "index": 0,
            "type": "main|buffer",
        },
    ],
    "sources": [
        {
            "id": "10 alphanums",
            "type": "vertex|fragment|include",
            "name": "freely chooseable",
            "stage": 0,
            "source": "text",
        },
    ],
}



DEFAULT_VERTEX_SRC = """
precision mediump float;
uniform vec2 iResolution;
attribute vec3 a_position;
varying vec2 _shadertox_n_pos;
varying vec2 _shadertox_s_pos;
void main() {
    gl_Position = vec4(a_position, 1);
    _shadertox_n_pos = a_position.xy;
    _shadertox_s_pos = (a_position.xy+1.) / 2. * iResolution;
}
""".strip()

DEFAULT_FRAGMEMT_PRE = """
precision mediump float;
uniform vec2 iResolution;
uniform float iTime;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
varying vec2 _shadertox_n_pos;
varying vec2 _shadertox_s_pos;
void mainImage(out vec4 fragColor, in vec2 fragCoord);
void main() {
    mainImage(gl_FragColor, vec2(_shadertox_s_pos.x,_shadertox_s_pos.y));
}
""".strip()


def fork_shader(shader):
    new_shader = Shader.objects.create(
        name=_("fork of %s") % shader.name,
        description=shader.description,
        forked_from=shader
    )

    for stage in ShaderStage.objects.filter(shader=shader):
        new_stage = ShaderStage.objects.create(
            name=stage.name,
            index=stage.index,
            stage_type=stage.stage_type,
            shader=new_shader,
        )
        for source in ShaderSource.objects.filter(stage=stage):
            ShaderSource.objects.create(
                stage=new_stage,
                source_type=source.source_type,
                name=source.name,
                source=source.source,
            )
    return new_shader


class DeserializationError(BaseException):
    pass


def shader_to_json(shader):
    dic = {
        "id": shader.shader_id,
        "name": shader.name,
        "description": shader.description,
        "urls": {
            "save": reverse("shaders:shader_save", args=(shader.shader_id,)),
            "newInclude": reverse("shaders:shader_new_include", args=(shader.shader_id,)),
        },
        "sources": [],
        "stages": [],
        "forks": [t[0] for t in Shader.objects.filter(forked_from=shader).values_list("shader_id")],
    }

    for stage in ShaderStage.objects.filter(shader=shader):
        dic["stages"].append({
            "id": stage.stage_id,
            "name": stage.name,
            "index": stage.index,
            "type": stage.stage_type,
            "fragment_pre": DEFAULT_FRAGMEMT_PRE,
        })

        dic["sources"].append({
            "type": "vertex",
            "name": _("vertex"),
            "source": DEFAULT_VERTEX_SRC,
            "stage": stage.index,
        })

        for source in ShaderSource.objects.filter(stage=stage):
            dic["sources"].append({
                "id": source.source_id,
                "type": source.source_type,
                "name": source.name,
                "source": source.source,
                "stage": stage.index,
            })

    dic["stages"].sort(key=lambda stage: stage["index"])
    dic["sources"].sort(key=lambda source: source["stage"])
    return dic


def _update_model(model, **kwargs):
    """Update all model-fields and call model.save() on any change"""
    changed = False
    for field_name in kwargs:
        value = kwargs[field_name]
        if getattr(model, field_name) != value:
            changed = True
            setattr(model, field_name, value)
    if changed:
        model.save()


def json_to_shader(data, shader):
    with transaction.atomic():
        _update_model(
            shader,
            name=data["name"],
            description=data["description"],
        )

        existing_stages = {stage.stage_id: stage
                           for stage in ShaderStage.objects.filter(shader=shader)}
        for stage_data in data["stages"]:
            if stage_data["id"] in existing_stages:
                _update_model(
                    existing_stages[stage_data["id"]],
                    name=stage_data["name"],
                    index=stage_data["index"],
                    stage_type=stage_data["type"],
                )
            else:
                raise DeserializationError("Unknown stage id '%s'" % stage_data["id"])

        existing_sources = {source.source_id: source
                            for source in ShaderSource.objects.filter(stage__shader=shader)}
        for source_data in data["sources"]:
            if "id" in source_data:
                if source_data["id"] in existing_sources:
                    _update_model(
                        existing_sources[source_data["id"]],
                        name=source_data["name"],
                        source=source_data["source"],
                    )
                else:
                    raise DeserializationError("Unknown source id '%s'" % source_data["id"])








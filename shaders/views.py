# -*- coding: utf-8 -*-
from __future__ import unicode_literals

import json

from django.shortcuts import render
from django.http import JsonResponse, Http404, HttpResponseRedirect
from django.urls import reverse
from django.db import transaction
from django.utils.translation import ugettext_lazy as _

from .tools import *


def shader_list_view(request):
    ctx = {
        "shaders": Shader.objects.all(),
    }
    return render(request, "shaders/shader-list.html", ctx)


def shader_edit_view(request, sid):
    try:
        shader = Shader.objects.get(shader_id=sid)
    except (Shader.DoesNotExist, ValueError):
        raise Http404

    fork_ids = [t[0] for t in Shader.objects.filter(forked_from=shader).values_list("shader_id")]
    ctx = {
        "shader": shader,
        "can_edit": True,
        "fork_ids": fork_ids,
        "num_forks": len(fork_ids),
        "num_views": ShaderView.objects.filter(shader=shader).count(),
    }


    if not request.session.session_key:
        request.session.create()
    ShaderView.objects.get_or_create(shader=shader, session_key=request.session.session_key)

    return render(request, "shaders/shader-edit.html", ctx)


def shader_load_json(request, sid):
    try:
        shader = Shader.objects.get(shader_id=sid)
    except (ValueError, Shader.DoesNotExist):
        return JsonResponse({"error": "Unknown id"})

    return JsonResponse(
        shader_to_json(shader)
    )


def shader_save_json(request, sid):
    try:
        shader = Shader.objects.get(shader_id=sid)
    except (ValueError, Shader.DoesNotExist):
        return JsonResponse({"error": "Unknown id"})

    if not request.is_ajax():
        return JsonResponse({"error": "no ajax data"})
    try:
        data = json.load(request)
    except BaseException as e:
        return JsonResponse({"error": "Could not load json: %s" % e})

    try:
        json_to_shader(data, shader)
    except DeserializationError as e:
        return JsonResponse({"error": "Could not store shader: %s" % e})

    return JsonResponse({"message": _("Shader %s saved") % shader.shader_id})


def shader_fork_view(request, sid):
    try:
        shader = Shader.objects.get(shader_id=sid)
    except (Shader.DoesNotExist, ValueError):
        raise Http404

    new_shader = fork_shader(shader)

    return HttpResponseRedirect(reverse("shaders:shader_edit", args=(new_shader.shader_id,)))


def shader_new_source_id(request, sid):
    #try:
    #    shader = Shader.objects.get(shader_id=sid)
    #except (Shader.DoesNotExist, ValueError):
    #    raise Http404
    return JsonResponse({"id": get_new_source_id()})


def shader_find_include(request):
    shader_name = request.GET.get("shader", "")
    source_name = request.GET.get("name", "")
    if not shader_name or not source_name:
        return JsonResponse({"error": _("invalid params")})

    try:
        shader = Shader.objects.get(shader_id=shader_name)
    except Shader.DoesNotExist:
        try:
            shader = Shader.objects.get(name=shader_name)
        except Shader.DoesNotExist:
            return JsonResponse({"error": _("Shader '%s' not found") % shader_name})

    try:
        source = ShaderSource.objects.get(stage__shader=shader, name=source_name)
    except ShaderSource.DoesNotExist:
        return JsonResponse({"error": _("Source '%s' not found in shader '%s'") % (source_name, shader_name)})

    ret = source_to_json(source)
    ret["readonly"] = True
    ret["name"] = "%s/%s" % (shader_name, source_name)
    return JsonResponse({"source": ret})

# -*- coding: utf-8 -*-
from __future__ import unicode_literals

import json

from django.shortcuts import render
from django.http import JsonResponse, Http404, HttpResponseRedirect
from django.urls import reverse
from django.db import transaction
from django.utils.translation import ugettext_lazy as _

from .models import *
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
    }

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

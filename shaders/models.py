# -*- coding: utf-8 -*-
from __future__ import unicode_literals

import random

from django.db import models, OperationalError
from django.utils.translation import ugettext_lazy as _
from django.urls import reverse
from django.db import transaction


def get_new_model_id(Model, field_name):
    possible = [chr(c) for c in range(ord('A'), ord('Z')+1)]
    possible += [chr(c) for c in range(ord('0'), ord('9')+1)]
    while True:
        shader_id = "".join(possible[random.randrange(len(possible))]
                            for i in range(10))
        try:
            Model.objects.get(**{field_name: shader_id})
        except (Model.DoesNotExist, OperationalError):
            return shader_id


def get_new_shader_id():
    return get_new_model_id(Shader, "shader_id")


def get_new_stage_id():
    return get_new_model_id(ShaderStage, "stage_id")


def get_new_source_id():
    return get_new_model_id(ShaderSource, "source_id")


class Shader(models.Model):

    shader_id = models.CharField(verbose_name=_("shader id"), max_length=10, default=get_new_shader_id)
    name = models.CharField(verbose_name=_("name"), max_length=100)

    forked_from = models.ForeignKey(verbose_name=_("forked from"), to="Shader", on_delete=models.PROTECT,
                                    null=True)


class ShaderStage(models.Model):

    stage_id = models.CharField(verbose_name=_("stage id"), max_length=10, default=get_new_stage_id)

    shader = models.ForeignKey(verbose_name=_("shader"), to="Shader", on_delete=models.PROTECT)
    name = models.CharField(verbose_name=_("name"), max_length=100)
    index = models.IntegerField(verbose_name=_("index"), default=0)

    stage_type = models.CharField(verbose_name=_("type"), max_length=20, default="main",
                                  choices=(
        ("main", _("main")),
        ("buffer", _("buffer")),
    ))


class ShaderSource(models.Model):

    source_id = models.CharField(verbose_name=_("shader id"), max_length=10, default=get_new_source_id)
    stage = models.ForeignKey(verbose_name=_("shader stage"), to="ShaderStage", on_delete=models.PROTECT)
    source_type = models.CharField(verbose_name=_("type"), max_length=20, default="include",
                                   choices=(
        ("vertex", _("vertex")),
        ("fragment", _("fragment")),
        ("include", _("include")),
    ))
    name = models.CharField(verbose_name=_("name"), max_length=100)
    source = models.TextField(verbose_name=_("source"))



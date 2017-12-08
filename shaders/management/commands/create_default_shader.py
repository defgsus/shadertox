# encoding=utf-8
from __future__ import unicode_literals

import datetime

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


class Command(BaseCommand):
    help = 'Creates default shader'

    def add_arguments(self, parser):
        pass

    def handle(self, *args, **options):
        create_default_shader()


DEFAULT_VERTEX_SOURCE = """
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    fragColor = vec4(fragCoord / iResolution, 0, 1);
}
""".strip() + "\n"

def create_default_shader():
    from shaders.models import Shader, ShaderSource, ShaderStage

    shader, created = Shader.objects.get_or_create(
        shader_id="0000000000",
        name="default",
        forked_from=None,
    )

    stage, created = ShaderStage.objects.get_or_create(
        stage_type="main",
        index=0,
        name="main",
        shader=shader,
    )

    source, created = ShaderSource.objects.get_or_create(
        source_type="fragment",
        source_id="0000000001",
        name="main",
        source=DEFAULT_VERTEX_SOURCE,
        stage=stage,
    )

    return shader
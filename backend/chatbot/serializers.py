from rest_framework import serializers


class ChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=1000, trim_whitespace=True)
    history = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list,
    )


class ChatResponseSerializer(serializers.Serializer):
    response = serializers.CharField()
    sources = serializers.ListField(child=serializers.DictField(), required=False)

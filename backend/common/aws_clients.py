"""
AWS client factory — Phase 2 only.
In Phase 1, these are never called. Included to satisfy imports in stubs.
"""
import os
import boto3


def get_bedrock_runtime():
    """Return a boto3 bedrock-runtime client."""
    kwargs = {"region_name": os.getenv("AWS_DEFAULT_REGION", "us-east-1")}
    if endpoint := os.getenv("AWS_ENDPOINT_URL"):
        kwargs["endpoint_url"] = endpoint
    return boto3.client("bedrock-runtime", **kwargs)


def get_ses_client():
    """Return a boto3 SES client."""
    kwargs = {"region_name": os.getenv("AWS_DEFAULT_REGION", "us-east-1")}
    if endpoint := os.getenv("AWS_ENDPOINT_URL"):
        kwargs["endpoint_url"] = endpoint
    return boto3.client("ses", **kwargs)


def get_s3_client():
    """Return a boto3 S3 client."""
    kwargs = {"region_name": os.getenv("AWS_DEFAULT_REGION", "us-east-1")}
    if endpoint := os.getenv("AWS_ENDPOINT_URL"):
        kwargs["endpoint_url"] = endpoint
    return boto3.client("s3", **kwargs)

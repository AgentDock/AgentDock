'use client';

/**
 * @fileoverview Node configuration form component.
 */

import * as React from "react";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NodeMetadata, NodePort } from "agentdock-core";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorInfo } from "react";

interface NodeConfigFormProps {
  nodeType: string;
  metadata: NodeMetadata;
  onSubmit: (config: Record<string, unknown>) => void;
}

/**
 * Create a form schema from node metadata
 */
function createFormSchema(metadata: NodeMetadata) {
  const schema: Record<string, z.ZodType<any>> = {};

  // Add input port fields
  metadata.inputs.forEach((input) => {
    let field: z.ZodType<any>;

    switch (input.type) {
      case 'string':
        field = input.required ? z.string().min(1) : z.string().optional();
        break;
      case 'number':
        field = input.required ? z.number() : z.number().optional();
        break;
      case 'boolean':
        field = input.required ? z.boolean() : z.boolean().optional();
        break;
      default:
        field = input.required ? z.unknown() : z.unknown().optional();
    }

    schema[input.id] = field;
  });

  return z.object(schema);
}

/**
 * Create default values from node metadata
 */
function createDefaultValues(metadata: NodeMetadata) {
  const defaults: Record<string, unknown> = {};

  metadata.inputs.forEach((input) => {
    if (input.defaultValue !== undefined) {
      defaults[input.id] = input.defaultValue;
    }
  });

  return defaults;
}

/**
 * Node configuration form component
 */
function BaseNodeConfigForm({ nodeType, metadata, onSubmit }: NodeConfigFormProps) {
  const formSchema = React.useMemo(() => createFormSchema(metadata), [metadata]);
  const defaultValues = React.useMemo(() => createDefaultValues(metadata), [metadata]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  /**
   * Handle form submission
   */
  const handleFormSubmit = useCallback(async (data: Record<string, unknown>) => {
    try {
      onSubmit(data);
      reset();
    } catch (error) {
      console.error("Failed to configure node:", error);
      alert("Failed to configure node. Please try again.");
    }
  }, [onSubmit, reset]);

  /**
   * Render an input field based on port type
   */
  const renderInput = useCallback((port: NodePort) => {
    const commonProps = {
      id: port.id,
      placeholder: port.label,
      ...register(port.id),
    };

    switch (port.type) {
      case 'string':
        if (port.schema && typeof port.schema === 'object' && 'multiline' in port.schema) {
          return (
            <Textarea
              {...commonProps}
              rows={(port.schema as { multiline: number }).multiline}
            />
          );
        }
        return <Input {...commonProps} />;
      case 'number':
        return <Input {...commonProps} type="number" />;
      case 'boolean':
        return <Input {...commonProps} type="checkbox" />;
      default:
        return <Input {...commonProps} />;
    }
  }, [register]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure {metadata.label}</CardTitle>
        <CardDescription>
          {metadata.description}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <CardContent className="space-y-4">
          {metadata.inputs.map((input) => (
            <div key={input.id} className="space-y-2">
              <Label htmlFor={input.id}>
                {input.label}
                {input.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              {renderInput(input)}
              {errors[input.id] && (
                <p className="text-sm text-red-500">
                  {errors[input.id]?.message as string}
                </p>
              )}
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="ml-auto"
          >
            {isSubmitting ? "Saving..." : "Save Configuration"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export function NodeConfigForm(props: NodeConfigFormProps) {
  return (
    <ErrorBoundary
      onError={(error: Error, errorInfo: ErrorInfo) => {
        console.error(`Error in NodeConfigForm for node type ${props.nodeType}:`, error, errorInfo);
      }}
      resetOnPropsChange
    >
      <BaseNodeConfigForm {...props} />
    </ErrorBoundary>
  );
} 
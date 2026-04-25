#!/bin/bash

# List of images with tags
images=(
  "555cijaiz555/ecomc:v5"
  "555cijaiz555/ecoms:v5"
)

# docker push 555cijaiz555/ecomc:v5 & docker push 555cijaiz555/ecoms:v5

# Loop through and push each image
for image in "${images[@]}"; do
  echo "Pushing $image..."
  docker push "$image"
  
  if [ $? -eq 0 ]; then
    echo "Successfully pushed $image"
  else
    echo "Failed to push $image"
  fi
done

echo "All push operations completed."